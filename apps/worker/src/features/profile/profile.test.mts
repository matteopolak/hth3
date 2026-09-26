import { describe, expect, it } from "vitest";
import type {
  D1Database,
  D1PreparedStatement,
  D1Result,
  D1Value,
  R2Bucket,
  R2ObjectBody,
} from "@civicresolve/db/d1";
import { handleProfileRequest } from "./index.js";

describe("private applicant profile routes", () => {
  it("requires an applicant identity with the dedicated profile permission", async () => {
    const database = new MemoryDatabase();
    const context = testContext(database, new MemoryBucket());

    const guest = await handleProfileRequest(
      new Request("https://worker.test/api/v1/profile"),
      new URL("https://worker.test/api/v1/profile"),
      context,
    );
    expect(guest?.status).toBe(401);

    const staff = await handleProfileRequest(
      authenticatedRequest("/api/v1/profile", "dev-civic-staff"),
      new URL("https://worker.test/api/v1/profile"),
      context,
    );
    expect(staff?.status).toBe(403);
  });

  it("stores uploads under a private owner key and supports owner-only read/delete", async () => {
    const database = new MemoryDatabase();
    const bucket = new MemoryBucket();
    const context = testContext(database, bucket);
    const form = new FormData();
    form.set(
      "file",
      new File([new TextEncoder().encode("%PDF-1.7 test")], "resume.pdf", {
        type: "application/pdf",
      }),
    );
    const uploadRequest = new Request(
      "https://worker.test/api/v1/profile/resumes",
      {
        method: "POST",
        headers: { Authorization: "Bearer dev-applicant" },
        body: form,
      },
    );
    const uploaded = await handleProfileRequest(
      uploadRequest,
      new URL(uploadRequest.url),
      context,
    );
    expect(uploaded?.status).toBe(201);
    const body = (await uploaded!.json()) as {
      resume: { id: string; filename: string };
    };
    expect(body.resume.filename).toBe("resume.pdf");
    expect(bucket.keys()).toEqual([
      expect.stringMatching(
        /^private\/resume\/guest\/local%3Aapplicant\/profile\//,
      ),
    ]);

    const ownRead = await handleProfileRequest(
      authenticatedRequest(
        `/api/v1/profile/resumes/${body.resume.id}`,
        "dev-applicant",
      ),
      new URL(`https://worker.test/api/v1/profile/resumes/${body.resume.id}`),
      context,
    );
    expect(ownRead?.status).toBe(200);
    expect(ownRead?.headers.get("Cache-Control")).toBe("no-store, private");
    expect(await ownRead?.text()).toBe("%PDF-1.7 test");

    const otherRoleRead = await handleProfileRequest(
      authenticatedRequest(
        `/api/v1/profile/resumes/${body.resume.id}`,
        "dev-hiring-reviewer",
      ),
      new URL(`https://worker.test/api/v1/profile/resumes/${body.resume.id}`),
      context,
    );
    expect(otherRoleRead?.status).toBe(403);

    const deleted = await handleProfileRequest(
      new Request(
        `https://worker.test/api/v1/profile/resumes/${body.resume.id}`,
        {
          method: "DELETE",
          headers: { Authorization: "Bearer dev-applicant" },
        },
      ),
      new URL(`https://worker.test/api/v1/profile/resumes/${body.resume.id}`),
      context,
    );
    expect(deleted?.status).toBe(200);
    expect(bucket.keys()).toEqual([]);
  });

  it("purges expired owner assets before returning them", async () => {
    const database = new MemoryDatabase();
    const bucket = new MemoryBucket();
    const context = testContext(database, bucket);
    const form = new FormData();
    form.set(
      "file",
      new File([new TextEncoder().encode("%PDF-1.7 test")], "resume.pdf", {
        type: "application/pdf",
      }),
    );
    const upload = await handleProfileRequest(
      new Request("https://worker.test/api/v1/profile/resumes", {
        method: "POST",
        headers: { Authorization: "Bearer dev-applicant" },
        body: form,
      }),
      new URL("https://worker.test/api/v1/profile/resumes"),
      context,
    );
    const body = (await upload!.json()) as { resume: { id: string } };
    database.assets.get(body.resume.id)!.retention_expires_at =
      "2020-01-01T00:00:00.000Z";

    const expired = await handleProfileRequest(
      authenticatedRequest(
        `/api/v1/profile/resumes/${body.resume.id}`,
        "dev-applicant",
      ),
      new URL(`https://worker.test/api/v1/profile/resumes/${body.resume.id}`),
      context,
    );
    expect(expired?.status).toBe(404);
    expect(database.assets.size).toBe(0);
    expect(bucket.keys()).toEqual([]);
  });
});

function authenticatedRequest(path: string, token: string): Request {
  return new Request(`https://worker.test${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

function testContext(database: MemoryDatabase, bucket: MemoryBucket) {
  return {
    env: {
      DB: database as unknown as D1Database,
      PRIVATE_ASSETS: bucket as unknown as R2Bucket,
      APP_ENV: "development" as const,
      DEV_AUTH_ENABLED: "true",
    },
    requestId: "profile-test",
    cors: new Headers(),
  };
}

interface TestResume {
  id: string;
  owner_subject: string;
  retention_expires_at: string;
  created_at: string;
  object_key: string;
  filename: string;
  content_type: string;
  byte_size: number;
}

class MemoryDatabase {
  readonly assets = new Map<string, TestResume>();
  profiles = new Map<string, { profile_json: string; updated_at: string }>();

  prepare(query: string): D1PreparedStatement {
    return new MemoryStatement(this, query) as unknown as D1PreparedStatement;
  }

  async batch(statements: D1PreparedStatement[]): Promise<D1Result[]> {
    const results: D1Result[] = [];
    for (const statement of statements) results.push(await statement.run());
    return results;
  }

  first<Row>(query: string, values: D1Value[]): Row | null {
    if (query.includes("SELECT COUNT(*) AS count FROM applicant_resumes"))
      return { count: this.assets.size } as Row;
    if (query.includes("FROM applicant_profiles WHERE owner_subject"))
      return (this.profiles.get(String(values[0])) as Row) ?? null;
    if (query.includes("FROM applicant_resumes AS r JOIN private_assets")) {
      const row = this.assets.get(String(values[1]));
      return row &&
        row.owner_subject === values[0] &&
        row.owner_subject === values[2]
        ? (row as Row)
        : null;
    }
    return null;
  }

  all<Row>(query: string, values: D1Value[]): Row[] {
    if (query.includes("organization_memberships")) return [];
    if (query.includes("FROM applicant_resumes AS r JOIN private_assets")) {
      const owner = String(values[0]);
      const now = String(values[1] ?? "");
      return [...this.assets.values()].filter(
        (row) =>
          row.owner_subject === owner &&
          (query.includes("retention_expires_at <= ?")
            ? row.retention_expires_at <= now
            : true),
      ) as Row[];
    }
    return [];
  }

  run(query: string, values: D1Value[]): D1Result {
    if (query.includes("INSERT INTO private_assets")) {
      const [id, owner, , objectKey, filename, contentType, size, createdAt] =
        values;
      this.assets.set(String(id), {
        id: String(id),
        owner_subject: String(owner),
        retention_expires_at: "",
        created_at: String(createdAt),
        object_key: String(objectKey),
        filename: String(filename),
        content_type: String(contentType),
        byte_size: Number(size),
      });
    } else if (query.includes("INSERT INTO applicant_resumes")) {
      const row = this.assets.get(String(values[0]));
      if (row) row.retention_expires_at = String(values[2]);
    } else if (query.includes("DELETE FROM applicant_resumes")) {
      this.assets.delete(String(values[0]));
    } else if (query.includes("DELETE FROM private_assets")) {
      this.assets.delete(String(values[0]));
    } else if (query.includes("INSERT INTO applicant_profiles")) {
      this.profiles.set(String(values[0]), {
        profile_json: String(values[1]),
        updated_at: String(values[2]),
      });
    } else if (query.includes("DELETE FROM applicant_profiles")) {
      this.profiles.delete(String(values[0]));
    }
    return {
      success: true,
      results: [],
      meta: {
        changes: 1,
        duration: 0,
        last_row_id: 0,
        rows_read: 0,
        rows_written: 1,
      },
    };
  }
}

class MemoryStatement {
  private values: D1Value[] = [];

  constructor(
    private readonly database: MemoryDatabase,
    private readonly query: string,
  ) {}

  bind(...values: D1Value[]): this {
    this.values = values;
    return this;
  }

  async first<Row>(): Promise<Row | null> {
    return this.database.first<Row>(this.query, this.values);
  }

  async all<Row>(): Promise<D1Result<Row>> {
    return {
      success: true,
      results: this.database.all<Row>(this.query, this.values),
      meta: {
        changes: 0,
        duration: 0,
        last_row_id: 0,
        rows_read: 0,
        rows_written: 0,
      },
    };
  }

  async run<Row>(): Promise<D1Result<Row>> {
    return this.database.run(this.query, this.values) as D1Result<Row>;
  }
}

class MemoryBucket {
  private readonly objects = new Map<string, Uint8Array>();

  async put(
    key: string,
    value: ArrayBuffer | ArrayBufferView | ReadableStream<Uint8Array> | string,
  ): Promise<unknown> {
    let bytes: Uint8Array;
    if (typeof value === "string") bytes = new TextEncoder().encode(value);
    else if (value instanceof ArrayBuffer) bytes = new Uint8Array(value);
    else if (ArrayBuffer.isView(value))
      bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    else bytes = new Uint8Array(await new Response(value).arrayBuffer());
    this.objects.set(key, bytes.slice());
    return { key };
  }

  async get(key: string): Promise<R2ObjectBody | null> {
    const bytes = this.objects.get(key);
    if (!bytes) return null;
    return {
      body: new Response(bytes.slice()).body!,
      size: bytes.byteLength,
      etag: "test-etag",
      writeHttpMetadata: (headers) =>
        headers.set("Content-Type", "application/pdf"),
    };
  }

  async head(key: string): Promise<unknown | null> {
    return this.objects.has(key) ? { key } : null;
  }

  async delete(key: string): Promise<void> {
    this.objects.delete(key);
  }

  keys(): string[] {
    return [...this.objects.keys()];
  }
}
