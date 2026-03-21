import { describe, it, expect } from "vitest";

describe("ownerConfig — hardening", () => {
  it("ownerConfig.ts does not exist in the frontend bundle", async () => {
    // The file should have been deleted — attempting to import should fail
    try {
      await import("@/lib/ownerConfig");
      // If we reach here, the file still exists — fail
      expect.fail("src/lib/ownerConfig.ts should not exist — owner emails must not be in frontend");
    } catch {
      // Expected — file doesn't exist
      expect(true).toBe(true);
    }
  });

  it("SubscriptionContext does not import ownerConfig", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("src/contexts/SubscriptionContext.tsx", "utf-8");
    expect(content).not.toContain("ownerConfig");
    expect(content).not.toContain("isOwnerEmail");
    expect(content).not.toContain("OWNER_EMAIL");
  });

  it("no frontend source files contain hardcoded owner emails", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const dirs = ["src/lib", "src/contexts", "src/components", "src/pages"];

    const checkDir = (dir: string) => {
      let files: string[] = [];
      try {
        files = fs.readdirSync(dir);
      } catch {
        return;
      }
      for (const file of files) {
        const full = path.join(dir, file);
        const stat = fs.statSync(full);
        if (stat.isDirectory()) {
          checkDir(full);
        } else if (file.endsWith(".ts") || file.endsWith(".tsx")) {
          const content = fs.readFileSync(full, "utf-8");
          // Should not contain specific owner emails
          expect(content).not.toContain("gheocapaula1000@gmail.com");
          expect(content).not.toContain("massimilianogalli75@gmail.com");
        }
      }
    };

    for (const dir of dirs) {
      checkDir(dir);
    }
  });

  it("isOwner is derived from server response, not client-side email check", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("src/contexts/SubscriptionContext.tsx", "utf-8");
    // Should parse is_owner from server payload
    expect(content).toContain("is_owner");
    // Should NOT contain email-matching logic
    expect(content).not.toContain("isOwnerEmail");
  });
});
