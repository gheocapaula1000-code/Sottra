import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("ownerConfig — hardening", () => {
  it("ownerConfig.ts does not exist in the frontend source", () => {
    expect(fs.existsSync("src/lib/ownerConfig.ts")).toBe(false);
  });

  it("SubscriptionContext does not import ownerConfig or use isOwnerEmail", () => {
    const content = fs.readFileSync("src/contexts/SubscriptionContext.tsx", "utf-8");
    expect(content).not.toContain("ownerConfig");
    expect(content).not.toContain("isOwnerEmail");
    expect(content).not.toContain("OWNER_EMAIL");
  });

  it("isOwner is derived from server response (is_owner field)", () => {
    const content = fs.readFileSync("src/contexts/SubscriptionContext.tsx", "utf-8");
    expect(content).toContain("is_owner");
    expect(content).not.toContain("isOwnerEmail");
  });

  it("no frontend source files contain hardcoded owner emails", () => {
    const dirs = ["src/lib", "src/contexts", "src/components", "src/pages"];

    const checkDir = (dir: string) => {
      let files: string[] = [];
      try { files = fs.readdirSync(dir); } catch { return; }
      for (const file of files) {
        const full = path.join(dir, file);
        const stat = fs.statSync(full);
        if (stat.isDirectory()) {
          checkDir(full);
        } else if (file.endsWith(".ts") || file.endsWith(".tsx")) {
          const content = fs.readFileSync(full, "utf-8");
          expect(content).not.toContain("gheocapaula1000@gmail.com");
          expect(content).not.toContain("massimilianogalli75@gmail.com");
          expect(content).not.toContain("matteo.ippolito@gmail.com");
        }
      }
    };

    for (const dir of dirs) {
      checkDir(dir);
    }
  });

  it("check-subscription uses isOwnerById, not isOwnerEmail", () => {
    const content = fs.readFileSync("supabase/functions/check-subscription/index.ts", "utf-8");
    expect(content).toContain("isOwnerById");
    expect(content).not.toContain("isOwnerEmail(");
  });

  it("check-subscription supports commercial bypass", () => {
    const content = fs.readFileSync("supabase/functions/check-subscription/index.ts", "utf-8");
    expect(content).toContain("isCommercialBypass");
    expect(content).toContain("commercial_bypass");
  });

  it("diagnostics uses server-side owner check, not email bypass", () => {
    const content = fs.readFileSync("supabase/functions/diagnostics/index.ts", "utf-8");
    expect(content).not.toContain("isOwnerEmail");
    expect(content).toContain("isOwnerById");
  });
});
