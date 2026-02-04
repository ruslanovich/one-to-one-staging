export const SALES_CALL_REVIEW_SCHEMA: Record<string, unknown> = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://example.com/schemas/sales_call_review.v1.json",
  title: "Sales Call Review (RU) v1",
  type: "object",
  additionalProperties: false,
  required: ["meta", "headline", "summary", "bant", "blocks_1_5"],
  properties: {
    meta: {
      type: "object",
      additionalProperties: false,
      required: ["transcript_filename", "sales_rep_name", "language"],
      properties: {
        transcript_filename: { type: "string", minLength: 1 },
        sales_rep_name: { type: "string", minLength: 1 },
        language: { type: "string", const: "ru" },
        call_id: { type: "string" },
        source: {
          type: "string",
          enum: ["zoom", "telemost", "meet", "phone", "other"],
        },
      },
    },
    headline: {
      type: "object",
      additionalProperties: false,
      required: ["label", "text"],
      properties: {
        label: { type: "string", const: "Заголовок (суть диалога)" },
        text: { type: "string", minLength: 1 },
      },
    },
    summary: {
      type: "object",
      additionalProperties: false,
      required: ["label", "text"],
      properties: {
        label: { type: "string", const: "Общее саммари (единый текст)" },
        text: { type: "string", minLength: 1 },
      },
    },
    bant: {
      type: "object",
      additionalProperties: false,
      required: ["label", "criteria", "total_score", "total_max", "verdict"],
      properties: {
        label: {
          type: "string",
          const: "BANT-саммари (вместо блока 6) — по 5-балльной шкале",
        },
        criteria: {
          type: "array",
          minItems: 4,
          maxItems: 4,
          items: { $ref: "#/$defs/bantCriterion" },
        },
        total_score: { type: "integer", minimum: 4, maximum: 20 },
        total_max: { type: "integer", const: 20 },
        verdict: { type: "string", minLength: 1 },
      },
    },
    blocks_1_5: {
      type: "array",
      minItems: 5,
      maxItems: 5,
      items: { $ref: "#/$defs/block1to5" },
    },
  },
  $defs: {
    timecode: {
      type: "string",
      pattern: "^[0-9]{2}:[0-9]{2}:[0-9]{2}$",
    },
    timeRange: {
      type: "object",
      additionalProperties: false,
      required: ["start", "end"],
      properties: {
        start: { $ref: "#/$defs/timecode" },
        end: { $ref: "#/$defs/timecode" },
      },
    },
    evidenceItem: {
      type: "object",
      additionalProperties: false,
      required: ["text", "time_ranges"],
      properties: {
        text: { type: "string", minLength: 1 },
        time_ranges: {
          type: "array",
          minItems: 1,
          items: { $ref: "#/$defs/timeRange" },
        },
        notes: { type: "string" },
      },
    },
    recommendationItem: {
      type: "object",
      additionalProperties: false,
      required: ["text"],
      properties: {
        text: { type: "string", minLength: 1 },
        priority: { type: "string", enum: ["low", "medium", "high"] },
      },
    },
    bantCriterion: {
      type: "object",
      additionalProperties: false,
      required: ["code", "label", "score", "max_score", "bullets"],
      properties: {
        code: { type: "string", enum: ["B", "A", "N", "T"] },
        label: {
          type: "string",
          enum: ["Budget", "Authority", "Need", "Timing"],
        },
        score: { type: "integer", minimum: 1, maximum: 5 },
        max_score: { type: "integer", const: 5 },
        bullets: {
          type: "array",
          minItems: 1,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["type", "text"],
            properties: {
              type: { type: "string", enum: ["positive", "risk"] },
              text: { type: "string", minLength: 1 },
            },
          },
        },
      },
    },
    block1to5: {
      type: "object",
      additionalProperties: false,
      required: ["block_number", "title", "sections"],
      properties: {
        block_number: { type: "integer", minimum: 1, maximum: 5 },
        title: {
          type: "string",
          enum: [
            "1) Раппорт и рамка встречи (с таймкодами)",
            "2) Выявление потребностей и болей (с таймкодами)",
            "3) Презентация решения Romikey под боли (с таймкодами)",
            "4) Отработка возражений (с таймкодами)",
            "5) Закрытие и следующий шаг (с таймкодами)",
          ],
        },
        sections: {
          type: "object",
          additionalProperties: false,
          required: [
            "client_insights",
            "sales_good_actions",
            "sales_bad_actions",
            "recommendations",
          ],
          properties: {
            client_insights: {
              type: "object",
              additionalProperties: false,
              required: ["label", "items"],
              properties: {
                label: { type: "string", const: "Инсайты от клиента" },
                items: { type: "array", items: { $ref: "#/$defs/evidenceItem" } },
              },
            },
            sales_good_actions: {
              type: "object",
              additionalProperties: false,
              required: ["label", "items"],
              properties: {
                label: { type: "string", const: "Хорошие действия сейлза" },
                items: { type: "array", items: { $ref: "#/$defs/evidenceItem" } },
              },
            },
            sales_bad_actions: {
              type: "object",
              additionalProperties: false,
              required: ["label", "items"],
              properties: {
                label: { type: "string", const: "Плохие действия сейлза" },
                items: { type: "array", items: { $ref: "#/$defs/evidenceItem" } },
              },
            },
            recommendations: {
              type: "object",
              additionalProperties: false,
              required: ["label", "items"],
              properties: {
                label: { type: "string", const: "Рекомендации по улучшению" },
                items: {
                  type: "array",
                  items: { $ref: "#/$defs/recommendationItem" },
                },
              },
            },
          },
        },
      },
    },
  },
};
