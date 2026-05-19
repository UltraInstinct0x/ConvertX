import { mkdir } from "node:fs/promises";
import { Elysia, t } from "elysia";
import sanitize from "sanitize-filename";
import { outputDir, uploadsDir } from "..";
import { handleConvert } from "../converters/main";
import db from "../db/db";
import { Jobs } from "../db/types";
import { WEBROOT } from "../helpers/env";
import { normalizeFiletype } from "../helpers/normalizeFiletype";
import { userService } from "./user";

export const convert = new Elysia().use(userService).post(
  "/convert",
  async ({ body, redirect, jwt, cookie: { auth, jobId } }) => {
    if (!auth?.value) {
      return redirect(`${WEBROOT}/login`, 302);
    }

    const user = await jwt.verify(auth.value);
    if (!user) {
      return redirect(`${WEBROOT}/login`, 302);
    }

    if (!jobId?.value) {
      return redirect(`${WEBROOT}/`, 302);
    }

    const existingJob = db
      .query("SELECT * FROM jobs WHERE id = ? AND user_id = ?")
      .as(Jobs)
      .get(jobId.value, user.id);

    if (!existingJob) {
      return redirect(`${WEBROOT}/`, 302);
    }

    const userUploadsDir = `${uploadsDir}${user.id}/${jobId.value}/`;
    const userOutputDir = `${outputDir}${user.id}/${jobId.value}/`;

    try {
      await mkdir(userOutputDir, { recursive: true });
    } catch (error) {
      console.error(`Failed to create the output directory: ${userOutputDir}.`, error);
    }

    const fileNames = JSON.parse(body.file_names) as string[];
    for (let i = 0; i < fileNames.length; i++) {
      fileNames[i] = sanitize(fileNames[i] || "");
    }
    if (!Array.isArray(fileNames) || fileNames.length === 0) {
      return redirect(`${WEBROOT}/`, 302);
    }

    // New-UI path: per-file targets. Map shape: { "<filename>": "ext,converter" }
    // Classic path: single convert_to applies to every file.
    type Group = { convertTo: string; converterName: string; files: string[] };
    const groups: Group[] = [];

    const isUnsafe = (s: string) => s.includes("/") || s.includes("\\") || s.includes("..");

    if (body.file_targets && body.file_targets.length > 0) {
      let perFile: Record<string, string>;
      try {
        perFile = JSON.parse(body.file_targets) as Record<string, string>;
      } catch {
        return redirect(`${WEBROOT}/`, 302);
      }
      const bucket = new Map<string, string[]>();
      for (const fname of fileNames) {
        const value = perFile[fname];
        if (!value || !value.includes(",")) continue;
        const [rawTo, converterName] = value.split(",");
        const convertTo = normalizeFiletype(rawTo ?? "");
        if (!converterName || isUnsafe(convertTo)) continue;
        const key = `${convertTo}\u0000${converterName}`;
        const arr = bucket.get(key) ?? [];
        arr.push(fname);
        bucket.set(key, arr);
      }
      for (const [key, files] of bucket) {
        const [convertTo, converterName] = key.split("\u0000");
        groups.push({ convertTo: convertTo!, converterName: converterName!, files });
      }
      if (groups.length === 0) {
        return redirect(`${WEBROOT}/`, 302);
      }
    } else {
      const ct = body.convert_to ?? "";
      const convertTo = normalizeFiletype(ct.split(",")[0] ?? "");
      const converterName = ct.split(",")[1];
      if (!converterName || isUnsafe(convertTo)) {
        return redirect(`${WEBROOT}/`, 302);
      }
      groups.push({ convertTo, converterName, files: fileNames });
    }

    const totalFiles = groups.reduce((n, g) => n + g.files.length, 0);
    db.query("UPDATE jobs SET num_files = ?1, status = 'pending' WHERE id = ?2").run(
      totalFiles,
      jobId.value,
    );

    // Fire all groups in parallel; flip job to 'completed' when all settle.
    Promise.all(
      groups.map((g) =>
        handleConvert(g.files, userUploadsDir, userOutputDir, g.convertTo, g.converterName, jobId),
      ),
    )
      .then(() => {
        if (jobId.value) {
          db.query("UPDATE jobs SET status = 'completed' WHERE id = ?1").run(jobId.value);
        }
      })
      .catch((error) => {
        console.error("Error in conversion process:", error);
      });

    return redirect(`${WEBROOT}/results/${jobId.value}`, 302);
  },
  {
    body: t.Object({
      convert_to: t.Optional(t.String()),
      file_names: t.String(),
      file_targets: t.Optional(t.String()),
    }),
    auth: true,
  },
);
