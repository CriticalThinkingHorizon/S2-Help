"use strict";

const crypto = require("crypto");
const { getPool, isEnabled } = require("../db/mysql");
const { loadDefinitions, getDefinition } = require("../polls/definitions");
const { validateAnswers, ValidationError } = require("../polls/validation");

const WALL_LIMIT = 5000;

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS polls (
    id CHAR(36) NOT NULL PRIMARY KEY,
    slug VARCHAR(64) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NULL,
    status ENUM('draft','active','closed') NOT NULL DEFAULT 'active',
    config JSON NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_polls_slug (slug)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS poll_questions (
    id CHAR(36) NOT NULL PRIMARY KEY,
    poll_id CHAR(36) NOT NULL,
    question_key VARCHAR(64) NOT NULL,
    prompt TEXT NOT NULL,
    type ENUM('boolean','single_choice') NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    config JSON NULL,
    UNIQUE KEY uq_poll_questions_key (poll_id, question_key),
    CONSTRAINT fk_poll_questions_poll FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS poll_options (
    id CHAR(36) NOT NULL PRIMARY KEY,
    question_id CHAR(36) NOT NULL,
    option_key VARCHAR(64) NOT NULL,
    label VARCHAR(255) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    metadata JSON NULL,
    UNIQUE KEY uq_poll_options_key (question_id, option_key),
    CONSTRAINT fk_poll_options_question FOREIGN KEY (question_id) REFERENCES poll_questions(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS poll_responses (
    id CHAR(36) NOT NULL PRIMARY KEY,
    poll_id CHAR(36) NOT NULL,
    public_id CHAR(36) NOT NULL,
    device_hash CHAR(64) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_poll_responses_public (public_id),
    UNIQUE KEY uq_poll_responses_device (poll_id, device_hash),
    KEY idx_poll_responses_created (poll_id, created_at),
    CONSTRAINT fk_poll_responses_poll FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS poll_answers (
    id CHAR(36) NOT NULL PRIMARY KEY,
    response_id CHAR(36) NOT NULL,
    question_id CHAR(36) NOT NULL,
    option_id CHAR(36) NOT NULL,
    value_text VARCHAR(255) NULL,
    UNIQUE KEY uq_poll_answers_response_question (response_id, question_id),
    KEY idx_poll_answers_option (question_id, option_id),
    CONSTRAINT fk_poll_answers_response FOREIGN KEY (response_id) REFERENCES poll_responses(id) ON DELETE CASCADE,
    CONSTRAINT fk_poll_answers_question FOREIGN KEY (question_id) REFERENCES poll_questions(id) ON DELETE CASCADE,
    CONSTRAINT fk_poll_answers_option FOREIGN KEY (option_id) REFERENCES poll_options(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
];

class PollUnavailableError extends Error {}
class PollNotFoundError extends Error {}

let initialized = null;
const seededPolls = new Map();

async function ensureSchema() {
  const pool = getPool();
  for (const statement of SCHEMA) {
    await pool.query(statement);
  }
}

async function seedPoll(definition) {
  const pool = getPool();
  const config = JSON.stringify({
    flow: definition.flow,
    stats: definition.stats,
    labels: definition.labels
  });

  await pool.execute(
    `INSERT INTO polls (id, slug, title, description, status, config)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE title = VALUES(title), description = VALUES(description),
       status = VALUES(status), config = VALUES(config)`,
    [crypto.randomUUID(), definition.slug, definition.title, definition.description,
      definition.status, config]
  );

  const [pollRows] = await pool.execute("SELECT id FROM polls WHERE slug = ? LIMIT 1", [definition.slug]);
  const pollId = pollRows[0].id;

  const questions = new Map();
  const questionList = [];

  for (const [index, question] of definition.questions.entries()) {
    const questionConfig = JSON.stringify({ type: question.type });
    await pool.execute(
      `INSERT INTO poll_questions (id, poll_id, question_key, prompt, type, sort_order, config)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE prompt = VALUES(prompt), type = VALUES(type),
         sort_order = VALUES(sort_order), config = VALUES(config)`,
      [crypto.randomUUID(), pollId, question.key, question.prompt, question.type, index, questionConfig]
    );

    const [questionRows] = await pool.execute(
      "SELECT id FROM poll_questions WHERE poll_id = ? AND question_key = ? LIMIT 1",
      [pollId, question.key]
    );
    const questionId = questionRows[0].id;
    const options = [];

    for (const [optionIndex, option] of question.options.entries()) {
      await pool.execute(
        `INSERT INTO poll_options (id, question_id, option_key, label, sort_order, metadata)
         VALUES (?, ?, ?, ?, ?, NULL)
         ON DUPLICATE KEY UPDATE label = VALUES(label), sort_order = VALUES(sort_order)`,
        [crypto.randomUUID(), questionId, option.key, option.label, optionIndex]
      );
      const [optionRows] = await pool.execute(
        "SELECT id FROM poll_options WHERE question_id = ? AND option_key = ? LIMIT 1",
        [questionId, option.key]
      );
      options.push({ ...option, id: optionRows[0].id });
    }

    const seededQuestion = {
      ...question,
      id: questionId,
      options,
      optionMap: new Map(options.map(function (option) { return [option.key, option]; }))
    };
    questions.set(question.key, seededQuestion);
    questionList.push(seededQuestion);
  }

  return {
    ...definition,
    pollId,
    questions,
    questionList
  };
}

async function runInitialization() {
  await ensureSchema();
  const definitions = loadDefinitions();
  for (const definition of definitions) {
    const seeded = await seedPoll(definition);
    seededPolls.set(seeded.slug, seeded);
  }
}

async function ensureInitialized() {
  if (!isEnabled()) {
    throw new PollUnavailableError("Poll database is not configured");
  }
  if (!initialized) {
    initialized = runInitialization().catch(function (error) {
      initialized = null;
      throw error;
    });
  }
  await initialized;
}

async function initializePolls() {
  if (!isEnabled()) {
    console.warn("[Polls] Database env is not configured; poll features are disabled.");
    return;
  }
  try {
    await ensureInitialized();
    console.log("[Polls] Poll schema and definitions ready.");
  } catch (error) {
    console.error("[Polls] Initialization failed:", error.message || error);
  }
}

async function getSeededPoll(slug) {
  if (!getDefinition(slug)) throw new PollNotFoundError("Poll not found");
  await ensureInitialized();
  const seeded = seededPolls.get(slug);
  if (!seeded) throw new PollNotFoundError("Poll not found");
  return seeded;
}

function toIso(value) {
  if (value instanceof Date) return value.toISOString();
  const date = new Date(value);
  return isNaN(date.getTime()) ? String(value) : date.toISOString();
}

function optionCount(optionRows, questionKey, optionKey) {
  const row = optionRows.find(function (item) {
    return item.questionKey === questionKey && item.optionKey === optionKey;
  });
  return row ? Number(row.count) : 0;
}

async function getStats(slug) {
  const seeded = await getSeededPoll(slug);
  const pool = getPool();
  const primary = seeded.questions.get(seeded.stats.primaryQuestion);
  const entrypoint = seeded.questions.get(seeded.stats.entrypointQuestion);
  const success = seeded.questions.get(seeded.stats.successQuestion);
  const workingEntrypoint = seeded.questions.get(seeded.stats.workingEntrypointQuestion);
  const [optionRows] = await pool.execute(
    `SELECT q.question_key AS questionKey, o.option_key AS optionKey, COUNT(*) AS count
     FROM poll_answers a
     JOIN poll_questions q ON q.id = a.question_id
     JOIN poll_options o ON o.id = a.option_id
     WHERE q.poll_id = ?
     GROUP BY q.question_key, o.option_key`,
    [seeded.pollId]
  );

  const [totalRows] = await pool.execute(
    "SELECT COUNT(*) AS count FROM poll_responses WHERE poll_id = ?",
    [seeded.pollId]
  );
  const [successRows] = await pool.execute(
    `SELECT COUNT(*) AS count
     FROM poll_responses r
     JOIN poll_answers a1 ON a1.response_id = r.id AND a1.question_id = ?
     JOIN poll_options o1 ON o1.id = a1.option_id AND o1.option_key <> ?
     JOIN poll_answers a2 ON a2.response_id = r.id AND a2.question_id = ?
     JOIN poll_options o2 ON o2.id = a2.option_id AND o2.option_key = ?
     WHERE r.poll_id = ?`,
    [primary.id, seeded.stats.brickedOption, success.id, seeded.stats.successOption, seeded.pollId]
  );
  const [brickRows] = await pool.execute(
    `SELECT r.public_id AS brickId, eo.option_key AS entrypoint, r.created_at AS createdAt
     FROM poll_responses r
     JOIN poll_answers a1 ON a1.response_id = r.id AND a1.question_id = ?
     JOIN poll_options o1 ON o1.id = a1.option_id AND o1.option_key = ?
     JOIN poll_answers a2 ON a2.response_id = r.id AND a2.question_id = ?
     JOIN poll_options eo ON eo.id = a2.option_id
     WHERE r.poll_id = ?
     ORDER BY r.created_at DESC
     LIMIT ${WALL_LIMIT}`,
    [primary.id, seeded.stats.brickedOption, entrypoint.id, seeded.pollId]
  );

  const questions = seeded.questionList.map(function (question) {
    const total = optionRows
      .filter(function (row) { return row.questionKey === question.key; })
      .reduce(function (sum, row) { return sum + Number(row.count); }, 0);
    return {
      key: question.key,
      prompt: question.prompt,
      type: question.type,
      options: question.options.map(function (option) {
        const count = optionCount(optionRows, question.key, option.key);
        return {
          key: option.key,
          label: option.label,
          count,
          percentage: total > 0 ? Math.round((count / total) * 1000) / 10 : 0
        };
      })
    };
  });

  const brickRowSlice = brickRows.slice().reverse();
  const bricked = optionCount(optionRows, primary.key, seeded.stats.brickedOption);
  const notBricked = Math.max(0, Number(totalRows[0].count) - bricked);
  const entrypointLabels = new Map(entrypoint.options.map(function (option) {
    return [option.key, option.label];
  }));

  return {
    poll: {
      slug: seeded.slug,
      title: seeded.title,
      description: seeded.description
    },
    totalResponses: Number(totalRows[0].count),
    bricked,
    notBricked,
    successWithoutBrick: Number(successRows[0].count),
    brickedByEntrypoint: entrypoint.options.map(function (option) {
      return {
        key: option.key,
        label: option.label,
        count: optionCount(optionRows, entrypoint.key, option.key)
      };
    }),
    workingByEntrypoint: workingEntrypoint.options.map(function (option) {
      return {
        key: option.key,
        label: option.label,
        count: optionCount(optionRows, workingEntrypoint.key, option.key)
      };
    }),
    questions,
    bricks: brickRowSlice.map(function (row) {
      return {
        brickId: row.brickId,
        entrypoint: row.entrypoint,
        entrypointLabel: entrypointLabels.get(row.entrypoint) || row.entrypoint,
        createdAt: toIso(row.createdAt)
      };
    }),
    brickLimit: WALL_LIMIT
  };
}

async function getReport(slug, deviceHash) {
  const seeded = await getSeededPoll(slug);
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT r.public_id AS publicId, r.created_at AS createdAt,
       q.question_key AS questionKey, o.option_key AS optionKey
     FROM poll_responses r
     JOIN poll_answers a ON a.response_id = r.id
     JOIN poll_questions q ON q.id = a.question_id
     JOIN poll_options o ON o.id = a.option_id
     WHERE r.poll_id = ? AND r.device_hash = ?
     ORDER BY q.sort_order`,
    [seeded.pollId, deviceHash]
  );
  if (!rows.length) return null;

  const answers = {};
  rows.forEach(function (row) {
    answers[row.questionKey] = row.optionKey;
  });

  return {
    publicId: rows[0].publicId,
    createdAt: toIso(rows[0].createdAt),
    answers
  };
}

async function submitResponse(slug, deviceHash, rawAnswers) {
  const seeded = await getSeededPoll(slug);
  const answers = validateAnswers(getDefinition(slug), rawAnswers);
  const pool = getPool();
  const responseId = crypto.randomUUID();
  const publicId = crypto.randomUUID();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    await connection.execute(
      "INSERT INTO poll_responses (id, poll_id, public_id, device_hash) VALUES (?, ?, ?, ?)",
      [responseId, seeded.pollId, publicId, deviceHash]
    );

    for (const [questionKey, optionKey] of Object.entries(answers)) {
      const question = seeded.questions.get(questionKey);
      const option = question && question.optionMap.get(optionKey);
      if (!question || !option) throw new ValidationError("Invalid answer");
      await connection.execute(
        "INSERT INTO poll_answers (id, response_id, question_id, option_id, value_text) VALUES (?, ?, ?, ?, NULL)",
        [crypto.randomUUID(), responseId, question.id, option.id]
      );
    }

    await connection.commit();
    return {
      created: true,
      report: {
        publicId,
        createdAt: new Date().toISOString(),
        answers
      }
    };
  } catch (error) {
    await connection.rollback();
    if (error && error.code === "ER_DUP_ENTRY") {
      return {
        created: false,
        report: await getReport(slug, deviceHash)
      };
    }
    throw error;
  } finally {
    connection.release();
  }
}

async function undoResponse(slug, deviceHash) {
  const seeded = await getSeededPoll(slug);
  const pool = getPool();
  const [result] = await pool.execute(
    "DELETE FROM poll_responses WHERE poll_id = ? AND device_hash = ?",
    [seeded.pollId, deviceHash]
  );
  return result.affectedRows > 0;
}

module.exports = {
  PollUnavailableError,
  PollNotFoundError,
  initializePolls,
  getStats,
  getReport,
  submitResponse,
  undoResponse
};
