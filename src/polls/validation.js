"use strict";

const { z } = require("zod");

const KEY_RE = /^[a-z0-9_-]{1,64}$/;
const SLUG_RE = /^[a-z0-9-]{1,64}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const optionSchema = z.object({
  key: z.string().regex(KEY_RE),
  label: z.string().min(1).max(255)
});

const questionSchema = z.object({
  key: z.string().regex(KEY_RE),
  prompt: z.string().min(1).max(1000),
  type: z.enum(["boolean", "single_choice"]),
  options: z.array(optionSchema).min(1)
});

const definitionSchema = z.object({
  slug: z.string().regex(SLUG_RE),
  title: z.string().min(1).max(255),
  description: z.string().max(2000).default(""),
  status: z.enum(["draft", "active", "closed"]).default("active"),
  questions: z.array(questionSchema).min(1),
  flow: z.record(z.string().regex(KEY_RE), z.record(z.string().regex(KEY_RE), z.array(z.string().regex(KEY_RE)))),
  stats: z.object({
    primaryQuestion: z.string().regex(KEY_RE),
    brickedOption: z.string().regex(KEY_RE),
    entrypointQuestion: z.string().regex(KEY_RE),
    successQuestion: z.string().regex(KEY_RE),
    successOption: z.string().regex(KEY_RE),
    workingEntrypointQuestion: z.string().regex(KEY_RE)
  }),
  privacy: z.string().max(3000).default(""),
  labels: z.record(z.string(), z.string()).default({})
});

const slugSchema = z.string().regex(SLUG_RE);
const deviceIdSchema = z.string().regex(UUID_RE);
const answerKeySchema = z.string().regex(KEY_RE);

const submitPayloadSchema = z.object({
  slug: slugSchema,
  deviceId: deviceIdSchema,
  answers: z.record(answerKeySchema, answerKeySchema).refine(function (answers) {
    return Object.keys(answers).length <= 8;
  }, "Too many answers")
}).strict();

const statusPayloadSchema = z.object({
  slug: slugSchema,
  deviceId: deviceIdSchema
}).strict();

class ValidationError extends Error {}

function parseDefinition(value) {
  return definitionSchema.parse(value);
}

function validateAnswers(definition, answers) {
  const primaryKey = definition.stats.primaryQuestion;
  const requiredKeys = new Set();

  function collect(key) {
    if (requiredKeys.has(key)) return;
    requiredKeys.add(key);
    const value = answers[key];
    if (!value) return;
    const next = definition.flow[key] && definition.flow[key][value];
    if (Array.isArray(next)) next.forEach(collect);
  }

  const primaryValue = answers[primaryKey];
  const primaryBranch = definition.flow[primaryKey] && definition.flow[primaryKey][primaryValue];
  if (!primaryValue || !primaryBranch) {
    throw new ValidationError("Invalid primary answer");
  }

  collect(primaryKey);

  Object.keys(answers).forEach(function (key) {
    if (!requiredKeys.has(key)) {
      throw new ValidationError("Unexpected answer");
    }
  });

  requiredKeys.forEach(function (key) {
    const question = definition.questions.find(function (item) {
      return item.key === key;
    });
    if (!question) {
      throw new ValidationError("Unknown question");
    }
    const value = answers[key];
    if (!value || !question.options.some(function (option) {
      return option.key === value;
    })) {
      throw new ValidationError("Invalid answer option");
    }
  });

  return answers;
}

module.exports = {
  ValidationError,
  parseDefinition,
  validateAnswers,
  submitPayloadSchema,
  statusPayloadSchema
};
