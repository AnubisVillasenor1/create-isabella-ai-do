import { describe, expect, it } from "vitest";
import {
  createHash,
  generateKeyPairSync,
  sign,
  type KeyObject,
} from "node:crypto";
import {
  computeTotp,
  DeviceTrustManager,
  hashPassword,
  IdentityProvider,
  SandboxRuntime,
  ZeroTrustCore,
} from "../../src/security/zero-trust/zero-trust-core";

const SESSION_CONTEXT = {
  ipAddress: "127.0.0.1",
  userAgent: "vitest",
  networkTrust: 0.9,
  timeOfDay: 12,
  deviceTrust: 0.5,
};

function webauthnAssertion(
  privateKey: KeyObject,
  challenge: string,
  rpId: string,
  origin: string,
  signCount = 1
): string {
  const clientDataJSON = Buffer.from(
    JSON.stringify({ type: "webauthn.get", challenge, origin, crossOrigin: false })
  );
  const authenticatorData = Buffer.alloc(37);
  createHash("sha256").update(rpId).digest().copy(authenticatorData, 0);
  authenticatorData[32] = 0x05; // user present + user verified
  authenticatorData.writeUInt32BE(signCount, 33);
  const signed = Buffer.concat([
    authenticatorData,
    createHash("sha256").update(clientDataJSON).digest(),
  ]);
  const signature = sign("sha256", signed, privateKey);
  return JSON.stringify({
    authenticatorData: authenticatorData.toString("base64url"),
    clientDataJSON: clientDataJSON.toString("base64url"),
    signature: signature.toString("base64url"),
  });
}

describe("IdentityProvider credential verification", () => {
  it("accepts a matching scrypt password and rejects a wrong one", async () => {
    const provider = new IdentityProvider();
    const identity = await provider.createIdentity("user", {}, [
      { type: "password", secretHash: hashPassword("correct horse battery staple"), metadata: {} },
    ]);
    const credential = identity.credentials[0];

    await expect(
      provider.verifyCredential(identity.id, credential.id, "", "correct horse battery staple")
    ).resolves.toEqual({ valid: true, factor: "password" });
    await expect(
      provider.verifyCredential(identity.id, credential.id, "", "wrong password")
    ).resolves.toEqual({ valid: false, factor: "password" });
  });

  it("rejects legacy unsalted SHA-256 password hashes", async () => {
    const provider = new IdentityProvider();
    const identity = await provider.createIdentity("user", {}, [
      {
        type: "password",
        secretHash: createHash("sha256").update("secret").digest("hex"),
        metadata: {},
      },
    ]);
    const credential = identity.credentials[0];

    expect(
      (await provider.verifyCredential(identity.id, credential.id, "", "secret")).valid
    ).toBe(false);
  });

  it("verifies an RFC 6238 TOTP code and rejects replay", async () => {
    const provider = new IdentityProvider();
    const secret = "JBSWY3DPEHPK3PXP";
    const identity = await provider.createIdentity("user", {}, [
      { type: "totp", metadata: { totpSecret: secret } },
    ]);
    const credential = identity.credentials[0];
    const code = computeTotp(secret);

    expect(
      (await provider.verifyCredential(identity.id, credential.id, "", code)).valid
    ).toBe(true);
    expect(
      (await provider.verifyCredential(identity.id, credential.id, "", code)).valid
    ).toBe(false);
  });

  it("does not accept any six digits when no TOTP secret is enrolled", async () => {
    const provider = new IdentityProvider();
    const identity = await provider.createIdentity("user", {}, [
      { type: "totp", metadata: {} },
    ]);
    const credential = identity.credentials[0];

    expect(
      (await provider.verifyCredential(identity.id, credential.id, "", "123456")).valid
    ).toBe(false);
  });

  it("verifies a WebAuthn assertion bound to RP ID, origin and challenge", async () => {
    const provider = new IdentityProvider();
    const pair = generateKeyPairSync("ec", { namedCurve: "P-256" });
    const publicKey = pair.publicKey.export({ type: "spki", format: "pem" }).toString();
    const identity = await provider.createIdentity("user", {}, [
      {
        type: "webauthn",
        publicKey,
        metadata: { rpId: "example.test", origin: "https://example.test" },
      },
    ]);
    const credential = identity.credentials[0];
    const challenge = "challenge-abc123";

    const assertion = webauthnAssertion(
      pair.privateKey,
      challenge,
      "example.test",
      "https://example.test"
    );
    expect(
      (await provider.verifyCredential(identity.id, credential.id, challenge, assertion)).valid
    ).toBe(true);
    expect(
      (await provider.verifyCredential(identity.id, credential.id, "other-challenge", assertion))
        .valid
    ).toBe(false);
  });

  it("fails closed when WebAuthn trust anchors are not configured", async () => {
    const provider = new IdentityProvider();
    const pair = generateKeyPairSync("ec", { namedCurve: "P-256" });
    const publicKey = pair.publicKey.export({ type: "spki", format: "pem" }).toString();
    const identity = await provider.createIdentity("user", {}, [
      {
        type: "webauthn",
        publicKey,
        metadata: { rpId: "", origin: "" },
      },
    ]);
    const credential = identity.credentials[0];
    const challenge = "challenge-abc123";
    const assertion = webauthnAssertion(
      pair.privateKey,
      challenge,
      "example.test",
      "https://example.test"
    );

    expect(
      (await provider.verifyCredential(identity.id, credential.id, challenge, assertion)).valid
    ).toBe(false);
  });

  it("rejects malformed certificate proofs instead of accepting them", async () => {
    const provider = new IdentityProvider();
    const pair = generateKeyPairSync("ec", { namedCurve: "P-256" });
    const publicKey = pair.publicKey.export({ type: "spki", format: "pem" }).toString();
    const identity = await provider.createIdentity("user", {}, [
      { type: "certificate", publicKey, metadata: {} },
    ]);
    const credential = identity.credentials[0];

    expect(
      (await provider.verifyCredential(identity.id, credential.id, "challenge", "{}")).valid
    ).toBe(false);
    expect(
      (await provider.verifyCredential(identity.id, credential.id, "challenge", "not-json")).valid
    ).toBe(false);
  });

  it("verifies a device key signature over the challenge", async () => {
    const provider = new IdentityProvider();
    const pair = generateKeyPairSync("ed25519");
    const publicKey = pair.publicKey.export({ type: "spki", format: "pem" }).toString();
    const identity = await provider.createIdentity("user", {}, [
      { type: "device", publicKey, metadata: {} },
    ]);
    const credential = identity.credentials[0];
    const challenge = "device-challenge";
    const attestation = "software-attestation";
    const signature = sign(
      null,
      Buffer.from(`${challenge}\n${attestation}`, "utf8"),
      pair.privateKey
    );
    const response = JSON.stringify({
      attestation,
      signature: signature.toString("base64"),
    });

    expect(
      (await provider.verifyCredential(identity.id, credential.id, challenge, response)).valid
    ).toBe(true);
    expect(
      (await provider.verifyCredential(identity.id, credential.id, "other", response)).valid
    ).toBe(false);
  });
});

describe("DeviceTrustManager attestation", () => {
  it("requires a fresh signature over a single-use server challenge", async () => {
    const manager = new DeviceTrustManager();
    const pair = generateKeyPairSync("ed25519");
    const publicKey = pair.publicKey.export({ type: "spki", format: "pem" }).toString();
    const enrollmentChallenge = "enroll-challenge";
    const quote = sign(null, Buffer.from(enrollmentChallenge, "utf8"), pair.privateKey).toString(
      "base64"
    );

    const device = await manager.enrollDevice("identity-1", "linux", {
      type: "software",
      quote,
      verificationKey: publicKey,
    });

    const challenge = manager.issueChallenge(device.id);
    expect(challenge).toBeTruthy();
    const response = sign(null, Buffer.from(challenge!, "utf8"), pair.privateKey).toString(
      "base64"
    );
    expect((await manager.verifyDevice(device.id, challenge!, response)).valid).toBe(true);

    // The challenge is consumed: replaying the same proof fails.
    expect((await manager.verifyDevice(device.id, challenge!, response)).valid).toBe(false);

    const nextChallenge = manager.issueChallenge(device.id)!;
    expect((await manager.verifyDevice(device.id, nextChallenge, quote)).valid).toBe(false);
    expect((await manager.verifyDevice(device.id, nextChallenge, response)).valid).toBe(false);
    expect(manager.issueChallenge(device.id)).toBeTruthy();
    expect(await manager.issueChallenge("dev_unknown")).toBeNull();

    const unattested = await manager.enrollDevice("identity-2", "linux", { type: "none" });
    const unattestedChallenge = manager.issueChallenge(unattested.id)!;
    expect((await manager.verifyDevice(unattested.id, unattestedChallenge, quote)).valid).toBe(
      false
    );
  });
});

describe("SandboxRuntime", () => {
  it("refuses to fake execution when no isolation backend exists", async () => {
    const sandbox = new SandboxRuntime();
    const result = await sandbox.execute("return 1", null);

    expect(result.success).toBe(false);
    expect(result.error).toBe("SANDBOX_BACKEND_UNAVAILABLE");
  });
});

describe("ZeroTrustCore authentication", () => {
  it("creates a session only for fully valid credentials and denies by default", async () => {
    const core = new ZeroTrustCore();
    const identity = await core.identityProvider.createIdentity("user", {}, [
      { type: "password", secretHash: hashPassword("isabella"), metadata: {} },
    ]);
    const credential = identity.credentials[0];
    const base = {
      identityId: identity.id,
      credentials: [{ credentialId: credential.id, challenge: "", response: "isabella" }],
      sessionContext: SESSION_CONTEXT,
      resource: "model:isabella",
      action: "read",
      environment: "test",
      roles: ["analyst"],
    };

    const result = await core.authenticateAndAuthorize(base);
    expect(result.session?.identityId).toBe(identity.id);
    expect(result.decision.action).toBe("deny");
    expect(result.decision.matchedPolicies).toEqual([]);

    await expect(
      core.authenticateAndAuthorize({
        ...base,
        credentials: [{ credentialId: credential.id, challenge: "", response: "wrong" }],
      })
    ).rejects.toThrow("AUTHENTICATION_FAILED");
  });

  it("requires device proof and verifies it against the enrolled attestation", async () => {
    const core = new ZeroTrustCore();
    const identity = await core.identityProvider.createIdentity("user", {}, [
      { type: "password", secretHash: hashPassword("isabella"), metadata: {} },
    ]);
    const credential = identity.credentials[0];

    const pair = generateKeyPairSync("ed25519");
    const publicKey = pair.publicKey.export({ type: "spki", format: "pem" }).toString();
    const enrollmentQuote = sign(
      null,
      Buffer.from("enrollment-challenge", "utf8"),
      pair.privateKey
    ).toString("base64");
    const device = await core.deviceManager.enrollDevice(identity.id, "linux", {
      type: "software",
      quote: enrollmentQuote,
      verificationKey: publicKey,
    });

    const base = {
      identityId: identity.id,
      credentials: [{ credentialId: credential.id, challenge: "", response: "isabella" }],
      deviceId: device.id,
      sessionContext: SESSION_CONTEXT,
      resource: "model:isabella",
      action: "read",
      environment: "test",
      roles: ["analyst"],
    };

    await expect(core.authenticateAndAuthorize(base)).rejects.toThrow("DEVICE_PROOF_REQUIRED");

    const deviceChallenge = core.issueDeviceChallenge(device.id);
    expect(deviceChallenge).toBeTruthy();
    const deviceResponse = sign(null, Buffer.from(deviceChallenge!, "utf8"), pair.privateKey).toString(
      "base64"
    );
    const proof = { challenge: deviceChallenge!, response: deviceResponse };

    const result = await core.authenticateAndAuthorize({
      ...base,
      deviceProof: proof,
    });
    expect(result.session?.deviceId).toBe(device.id);

    // A consumed challenge cannot be replayed.
    await expect(
      core.authenticateAndAuthorize({ ...base, deviceProof: proof })
    ).rejects.toThrow("DEVICE_VERIFICATION_FAILED");
  });
});
