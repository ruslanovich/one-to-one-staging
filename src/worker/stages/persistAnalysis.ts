import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Pool } from "pg";
import { QueueJob } from "../../queue/types";
import { StorageClient } from "../../storage/types";

export async function persistAnalysis(input: {
  job: QueueJob;
  db: Pool;
  storage: StorageClient;
  bucket: string;
  analysisObjectPath: string;
}): Promise<void> {
  const tempDir = await fs.mkdtemp(join(tmpdir(), "analysis-"));
  const analysisFile = join(tempDir, `${input.job.callId}.analysis.json`);

  try {
    await input.storage.download(input.bucket, input.analysisObjectPath, analysisFile);
    const analysisText = await fs.readFile(analysisFile, "utf8");
    let analysis: any;
    try {
      analysis = JSON.parse(analysisText);
    } catch (error) {
      throw new Error(`analysis JSON parse failed: ${error}`);
    }

    const meta = analysis?.meta ?? {};
    const transcriptFilename = String(meta.transcript_filename ?? "").trim();
    const salesRepName = String(meta.sales_rep_name ?? "").trim();
    const language = String(meta.language ?? "").trim();
    const source = meta.source ? String(meta.source) : null;

    const headlineText = String(analysis?.headline?.text ?? "").trim();
    const summaryText = String(analysis?.summary?.text ?? "").trim();

    const bant = analysis?.bant ?? {};
    const bantTotalScore = Number(bant.total_score ?? NaN);
    const bantTotalMax = Number(bant.total_max ?? NaN);
    const bantVerdict = String(bant.verdict ?? "").trim();
    const bantCriteria = Array.isArray(bant.criteria) ? bant.criteria : [];

    const blocks = Array.isArray(analysis?.blocks_1_5) ? analysis.blocks_1_5 : [];

    if (!transcriptFilename) {
      throw new Error("analysis meta.transcript_filename is required");
    }
    if (!salesRepName) {
      throw new Error("analysis meta.sales_rep_name is required");
    }
    if (!language) {
      throw new Error("analysis meta.language is required");
    }
    if (!headlineText) {
      throw new Error("analysis headline.text is required");
    }
    if (!summaryText) {
      throw new Error("analysis summary.text is required");
    }
    if (!Number.isFinite(bantTotalScore) || !Number.isFinite(bantTotalMax)) {
      throw new Error("analysis bant totals are required");
    }
    if (!bantVerdict) {
      throw new Error("analysis bant.verdict is required");
    }

    const client = await input.db.connect();
    try {
      await client.query("begin");

      const existing = await client.query<{ id: string }>(
        `select id
         from call_analyses
         where analysis_storage_path = $1
         limit 1`,
        [input.analysisObjectPath],
      );
      if (existing.rows.length > 0) {
        await client.query("rollback");
        return;
      }

      const analysisInsert = await client.query<{ id: string }>(
        `insert into call_analyses (
           org_id,
           call_id,
           analysis_storage_path,
           transcript_filename,
           sales_rep_name,
           language,
           source,
           headline_text,
           summary_text,
           bant_total_score,
           bant_total_max,
           bant_verdict
         )
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         returning id`,
        [
          input.job.orgId,
          input.job.callId,
          input.analysisObjectPath,
          transcriptFilename,
          salesRepName,
          language,
          source,
          headlineText,
          summaryText,
          bantTotalScore,
          bantTotalMax,
          bantVerdict,
        ],
      );
      const analysisId = analysisInsert.rows[0]?.id;
      if (!analysisId) {
        throw new Error("failed to insert call_analyses row");
      }

      for (const criterion of bantCriteria) {
        const code = String(criterion?.code ?? "").trim();
        const label = String(criterion?.label ?? "").trim();
        const score = Number(criterion?.score ?? NaN);
        const maxScore = Number(criterion?.max_score ?? NaN);

        const criterionInsert = await client.query<{ id: string }>(
          `insert into call_analysis_bant_criteria (
             analysis_id,
             code,
             label,
             score,
             max_score
           )
           values ($1, $2, $3, $4, $5)
           returning id`,
          [analysisId, code, label, score, maxScore],
        );
        const criterionId = criterionInsert.rows[0]?.id;
        if (!criterionId) {
          throw new Error("failed to insert BANT criterion");
        }

        const bullets = Array.isArray(criterion?.bullets) ? criterion.bullets : [];
        for (const bullet of bullets) {
          const bulletType = String(bullet?.type ?? "").trim();
          const bulletText = String(bullet?.text ?? "").trim();
          await client.query(
            `insert into call_analysis_bant_bullets (criterion_id, type, text)
             values ($1, $2, $3)`,
            [criterionId, bulletType, bulletText],
          );
        }
      }

      for (const block of blocks) {
        const blockNumber = Number(block?.block_number ?? NaN);
        const title = String(block?.title ?? "").trim();
        const blockInsert = await client.query<{ id: string }>(
          `insert into call_analysis_blocks (analysis_id, block_number, title)
           values ($1, $2, $3)
           returning id`,
          [analysisId, blockNumber, title],
        );
        const blockId = blockInsert.rows[0]?.id;
        if (!blockId) {
          throw new Error("failed to insert analysis block");
        }

        const sections = block?.sections ?? {};
        await insertSectionItems(client, blockId, "client_insights", sections?.client_insights);
        await insertSectionItems(
          client,
          blockId,
          "sales_good_actions",
          sections?.sales_good_actions,
        );
        await insertSectionItems(
          client,
          blockId,
          "sales_bad_actions",
          sections?.sales_bad_actions,
        );

        const recommendations = sections?.recommendations?.items;
        if (Array.isArray(recommendations)) {
          for (const rec of recommendations) {
            const recText = String(rec?.text ?? "").trim();
            const priority = rec?.priority ? String(rec.priority).trim() : null;
            await client.query(
              `insert into call_analysis_recommendations (block_id, text, priority)
               values ($1, $2, $3)`,
              [blockId, recText, priority],
            );
          }
        }
      }

      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

async function insertSectionItems(
  client: {
    query<T = unknown>(text: string, params?: unknown[]): Promise<{ rows: T[] }>;
  },
  blockId: string,
  section: "client_insights" | "sales_good_actions" | "sales_bad_actions",
  sectionPayload: any,
): Promise<void> {
  const items = Array.isArray(sectionPayload?.items) ? sectionPayload.items : [];
  for (const item of items) {
    const text = String(item?.text ?? "").trim();
    const notes = item?.notes ? String(item.notes).trim() : null;
    const itemInsert = await client.query<{ id: string }>(
      `insert into call_analysis_section_items (block_id, section, text, notes)
       values ($1, $2, $3, $4)
       returning id`,
      [blockId, section, text, notes],
    );
    const itemId = itemInsert.rows[0]?.id;
    if (!itemId) {
      throw new Error("failed to insert section item");
    }

    const ranges = Array.isArray(item?.time_ranges) ? item.time_ranges : [];
    for (const range of ranges) {
      const start = String(range?.start ?? "").trim();
      const end = String(range?.end ?? "").trim();
      await client.query(
        `insert into call_analysis_time_ranges (section_item_id, start_time, end_time)
         values ($1, $2, $3)`,
        [itemId, start, end],
      );
    }
  }
}
