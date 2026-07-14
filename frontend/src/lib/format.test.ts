import { describe, expect, it } from "vitest";
import { formatCents, formatDate, nightsBetween, parseBRLToCents } from "./format";

describe("parseBRLToCents", () => {
  it("converte valor com vírgula decimal", () => {
    expect(parseBRLToCents("1.234,56")).toBe(123456);
  });

  it("converte valor simples", () => {
    expect(parseBRLToCents("450,00")).toBe(45000);
    expect(parseBRLToCents("450")).toBe(45000);
  });

  it("arredonda centavos corretamente", () => {
    expect(parseBRLToCents("0,01")).toBe(1);
    expect(parseBRLToCents("99,99")).toBe(9999);
  });

  it("entrada inválida vira NaN (rejeitada pelo formulário)", () => {
    expect(Number.isNaN(parseBRLToCents("abc"))).toBe(true);
  });
});

describe("formatCents", () => {
  it("formata centavos em BRL", () => {
    expect(formatCents(123456)).toMatch(/1\.234,56/);
    expect(formatCents(0)).toMatch(/0,00/);
  });
});

describe("formatDate", () => {
  it("formata ISO em pt-BR usando UTC (sem deslocar o dia)", () => {
    expect(formatDate("2030-01-04T00:00:00.000Z")).toBe("04/01/2030");
  });
});

describe("nightsBetween", () => {
  it("conta as diárias entre entrada e saída", () => {
    expect(nightsBetween("2030-01-04", "2030-01-06")).toBe(2);
  });

  it("bate-volta conta 1 diária, não zero", () => {
    expect(nightsBetween("2030-01-04", "2030-01-04")).toBe(1);
  });
});
