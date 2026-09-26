import { describe, expect, it } from "vitest";
import { extractResumeText } from "./document-text.js";
import {
  EMPTY_APPLICANT_PROFILE,
  suggestResumeFields,
  validateApplicantProfile,
} from "./index.js";

describe("applicant profile fields", () => {
  it("accepts supported manual fields and rejects unsupported personal data", () => {
    expect(
      validateApplicantProfile({
        ...EMPTY_APPLICANT_PROFILE,
        name: "Ada Example",
        email: "ada@example.ca",
        skills: ["TypeScript", "Accessibility"],
      }),
    ).toMatchObject({
      name: "Ada Example",
      skills: ["TypeScript", "Accessibility"],
    });

    expect(
      validateApplicantProfile({
        ...EMPTY_APPLICANT_PROFILE,
        dateOfBirth: "1990-01-01",
      }),
    ).toBeNull();
    expect(
      validateApplicantProfile({
        ...EMPTY_APPLICANT_PROFILE,
        email: "not an email",
      }),
    ).toBeNull();
  });

  it("stops at the requested suggestion cap", () => {
    expect(suggestResumeFields("SKILLS\nfirst, second, third", 2)).toHaveLength(
      2,
    );
  });

  it("returns literal suggestions with source spans and leaves unlabeled facts alone", () => {
    const text = [
      "Name: Ada Example",
      "ada@example.ca",
      "SUMMARY",
      "Built accessible services for residents.",
      "EDUCATION",
      "Example University — BSc Computer Science",
      "SKILLS",
      "TypeScript, Accessibility",
      "Age: 34",
    ].join("\n");
    const suggestions = suggestResumeFields(text);

    expect(suggestions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "name",
          value: "Ada Example",
          source: expect.objectContaining({ text: "Ada Example" }),
        }),
        expect.objectContaining({
          field: "email",
          value: "ada@example.ca",
          source: expect.objectContaining({ text: "ada@example.ca" }),
        }),
        expect.objectContaining({
          field: "summary",
          value: "Built accessible services for residents.",
        }),
        expect.objectContaining({
          field: "education",
          value: "Example University — BSc Computer Science",
        }),
        expect.objectContaining({ field: "skills", value: "Accessibility" }),
      ]),
    );
    expect(suggestions.some((item) => item.value === "34")).toBe(false);
    for (const suggestion of suggestions)
      expect(text.slice(suggestion.source.start, suggestion.source.end)).toBe(
        suggestion.source.text,
      );
  });
});

describe("resume document text extraction", () => {
  it("reads compressed PDF text operators, including balanced parentheses", async () => {
    const text = await extractResumeText(
      fromBase64(PDF_FIXTURE),
      "application/pdf",
    );
    expect(text).toBe(
      "Name: Ada (Senior) Example\nSUMMARY\nBuilt accessible services.",
    );
    const suggestions = suggestResumeFields(text);
    for (const suggestion of suggestions)
      expect(text.slice(suggestion.source.start, suggestion.source.end)).toBe(
        suggestion.source.text,
      );
    expect(suggestions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "name",
          value: "Ada (Senior) Example",
        }),
        expect.objectContaining({
          field: "summary",
          value: "Built accessible services.",
        }),
      ]),
    );
  });

  it("reads paragraph text from the DOCX main document XML part", async () => {
    const text = await extractResumeText(
      fromBase64(DOCX_FIXTURE),
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    expect(text).toBe("Name: Ada & Grace\nSKILLS\nTypeScript");
    const suggestions = suggestResumeFields(text);
    for (const suggestion of suggestions)
      expect(text.slice(suggestion.source.start, suggestion.source.end)).toBe(
        suggestion.source.text,
      );
    expect(suggestions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "name", value: "Ada & Grace" }),
        expect.objectContaining({ field: "skills", value: "TypeScript" }),
      ]),
    );
  });

  it("rejects scanned or unsupported files so the applicant can use manual entry", async () => {
    const scannedPdf = new TextEncoder().encode(
      "%PDF-1.7\n1 0 obj\n<< /Type /Page >>\nendobj\n%%EOF",
    );
    await expect(
      extractResumeText(scannedPdf, "application/pdf"),
    ).rejects.toMatchObject({ name: "UnsupportedResumeDocumentError" });

    const mappedPdf = new TextEncoder().encode(
      "%PDF-1.7\n1 0 obj\n<< /ToUnicode 2 0 R >>\nendobj\n%%EOF",
    );
    await expect(
      extractResumeText(mappedPdf, "application/pdf"),
    ).rejects.toThrow("character map");
  });
});

function fromBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

// Generated as a valid one-page PDF with a FlateDecode content stream.
const PDF_FIXTURE =
  "JVBERi0xLjcKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUl0gL0NvdW50IDEgPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvUmVzb3VyY2VzIDw8IC9Gb250IDw8IC9GMSA1IDAgUiA+PiA+PiAvTWVkaWFCb3ggWzAgMCA2MTIgNzkyXSAvQ29udGVudHMgNCAwIFIgPj4KZW5kb2JqCjQgMCBvYmoKPDwgL0xlbmd0aCA4NCAvRmlsdGVyIC9GbGF0ZURlY29kZSA+PgpzdHJlYW0KeJxzClHQ8EvMTbVScExJVNAITs3LzC/SVHCtSMwtyEnVVAjJUnAN4XICqgoO9fV1DIpEFnIqzcwpUUhMTk4tLs5MyklVKE4tKssE8vSgqgAtDhyrCmVuZHN0cmVhbQplbmRvYmoKNSAwIG9iago8PCAvVHlwZSAvRm9udCAvU3VidHlwZSAvVHlwZTEgL0Jhc2VGb250IC9IZWx2ZXRpY2EgPj4KZW5kb2JqCnhyZWYKMCA2CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDAwOSAwMDAwMCBuIAowMDAwMDAwMDU4IDAwMDAwIG4gCjAwMDAwMDAxMTUgMDAwMDAgbiAKMDAwMDAwMDI0MSAwMDAwMCBuIAowMDAwMDAwMzk2IDAwMDAwIG4gCnRyYWlsZXIKPDwgL1NpemUgNiAvUm9vdCAxIDAgUiA+PgpzdGFydHhyZWYKNDY2CiUlRU9GCg==";

// Generated by Python's zipfile with ZIP_DEFLATED and valid CRC/central directory data.
const DOCX_FIXTURE =
  "UEsDBBQAAAAIABVqOl3ffSMzWQAAALIAAAARAAAAd29yZC9kb2N1bWVudC54bWyzKbdKyU8uzU3NK7GzKbdKyk+pBNEFIKIIRJTY+SXmplopOKYkKqgl5hZYK7gXJSan2uiDpEBkEZgsQNcV7O3p4xNMUFlIZUFqcHJRZkEJFqX6MAfpI7kSAFBLAQIUAxQAAAAIABVqOl3ffSMzWQAAALIAAAARAAAAAAAAAAAAAACAAQAAAAB3b3JkL2RvY3VtZW50LnhtbFBLBQYAAAAAAQABAD8AAACIAAAAAAA=";
