import type { ReactNode } from "react";

const keywords = new Set([
  "as",
  "async",
  "await",
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "else",
  "enum",
  "export",
  "false",
  "for",
  "from",
  "func",
  "guard",
  "if",
  "import",
  "in",
  "is",
  "let",
  "new",
  "nil",
  "null",
  "private",
  "return",
  "self",
  "static",
  "struct",
  "switch",
  "throw",
  "true",
  "try",
  "type",
  "var",
  "where",
  "while",
]);
const sqlKeywords = new Set([
  "ADD",
  "ALTER",
  "AND",
  "AS",
  "BY",
  "CREATE",
  "DEFAULT",
  "DELETE",
  "DISTINCT",
  "DROP",
  "FROM",
  "GROUP",
  "IF",
  "INDEX",
  "INSERT",
  "INTO",
  "JOIN",
  "LIMIT",
  "NOT",
  "NULL",
  "ON",
  "OR",
  "ORDER",
  "PRIMARY",
  "SELECT",
  "SET",
  "TABLE",
  "UPDATE",
  "VALUES",
  "WHERE",
]);
const types = new Set([
  "Array",
  "Bool",
  "Boolean",
  "Date",
  "Double",
  "Float",
  "Int",
  "JSON",
  "String",
  "TEXT",
  "INTEGER",
  "REAL",
  "TIMESTAMP",
  "UUID",
  "Void",
  "bigint",
  "boolean",
  "number",
  "string",
  "undefined",
  "unknown",
  "void",
]);

const color = {
  comment: "#9aa5b6",
  string: "#e9bc7e",
  number: "#d2a8f2",
  keyword: "#95b4ff",
  sql: "#e7a9d4",
  type: "#88d5c7",
  call: "#c6b4f2",
  operator: "#b9c3d3",
} as const;

// A line-oriented lexer keeps original spacing and handles the TS, Swift, and
// SQL excerpts in this film without adding a browser-side highlighter package.
const tokenPattern =
  /(?:\/\/.*$|--.*$|\/\*.*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\/(?:\\.|[^/\\\n])+\/[gimsuy]*|\b\d+(?:\.\d+)?\b|\b[A-Za-z_$][\w$]*\b|[=+*/!?<>|&%:\-]+|\s+|.)/g;

export function highlightCode(line: string, file: string): ReactNode[] {
  const sql = file.toLowerCase().endsWith(".sql");
  const tokens = Array.from(line.matchAll(tokenPattern));
  return tokens.map(([token], index) => {
    let shade: string | undefined;
    if (
      token.startsWith("//") ||
      (sql && token.startsWith("--")) ||
      token.startsWith("/*")
    )
      shade = color.comment;
    else if (/^["'`]/.test(token) || /^\/(?![/*])/.test(token))
      shade = color.string;
    else if (/^\d/.test(token)) shade = color.number;
    else if (sql && sqlKeywords.has(token.toUpperCase())) shade = color.sql;
    else if (keywords.has(token)) shade = color.keyword;
    else if (types.has(token)) shade = color.type;
    else if (
      /^[A-Za-z_$]/.test(token) &&
      /^\s*\(/.test(line.slice((tokens[index]?.index ?? 0) + token.length))
    )
      shade = color.call;
    else if (/^[=+*/!?<>|&%:\-]+$/.test(token)) shade = color.operator;
    return (
      <span key={index} style={shade ? { color: shade } : undefined}>
        {token}
      </span>
    );
  });
}
