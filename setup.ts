import {
  Account,
  Algorithms,
  decode,
  encodeAccount,
  encodeActivation,
  encodeUser,
  Export,
  fmtCreds,
  Import,
  NGS,
} from "/Users/synadia/Dropbox/code/src/github.com/ConnectEverything/ngsapi-js/src/mod.ts";
import {
  TestEnv,
} from "/Users/synadia/Dropbox/code/src/github.com/ConnectEverything/ngsapi-js/tests/util.ts";

import {
  createAccount,
  createUser,
  fromSeed,
  KeyPair,
} from "https://deno.land/x/nkeys.js/modules/esm/mod.ts";

const conf = await TestEnv();

async function read(fp: string): Promise<string> {
  try {
    await Deno.stat(fp);
    return Deno.readTextFile(fp);
  } catch (err) {
    return Promise.resolve("");
  }
}

function assetPath(dir: string, name: string): string {
  return `${dir}/${name}`;
}

async function maybeMkAccount(
  name: string,
): Promise<{ jwt: string; key: KeyPair }> {
  const dir = `./${name}`;
  try {
    Deno.statSync(dir);
  } catch (err) {
    await Deno.mkdir(dir);
  }

  const seedPath = assetPath(name, "seed.nk");
  const sd = await read(seedPath);
  let key: KeyPair;
  if (sd === "") {
    key = createAccount();
    await Deno.writeTextFile(seedPath, new TextDecoder().decode(key.getSeed()));
  } else {
    key = fromSeed(new TextEncoder().encode(sd));
  }

  const jwtPath = assetPath(name, "account.jwt");
  let jwt = await read(jwtPath);
  if (jwt === "") {
    jwt = await encodeAccount(name, key, {}, { algorithm: Algorithms.v1 });
    const ngs = new NGS(conf);
    await ngs.pushAccount(jwt);

    // THIS CODE WONT RUN IN PRODUCTION

    // const cm = ngs.adminCm(await connect(conf.connectOptions()));
    // await cm.authorizeAccountEmail(key.getPublicKey(), generateEmail("a"));
    // await cm.connection.close();
    // let status = await ngs.status(key);
    // assert(status.plan.length > 0);
    // assertEquals(status.email_verified, true);
    // await cm.connection.close();
    //
    // await ngs.setPlan(conf.seed(), {
    //   account: key.getPublicKey(),
    //   plan: "dev_promo_2",
    // });
    //
    // status = await ngs.status(key);
    // assert(status.plan.length > 0);

    jwt = await ngs.getRawAccount(key);
    await Deno.writeTextFile(jwtPath, jwt);
  }
  return { jwt, key };
}

async function maybeAddImport(
  issuer: KeyPair,
  akp: KeyPair,
  token: string,
): Promise<string> {
  const ac = await decode<Account>(token);
  const pk = issuer.getPublicKey();
  let imports = ac.nats?.imports?.filter((i) => {
    return i.account === pk;
  });
  imports = imports || [];

  if (imports.length === 0) {
    const im = {} as Import;
    im.name = "MyServiceClient";
    im.type = "service";
    im.to = "q";
    im.account = issuer.getPublicKey();
    im.subject = `q.${ac.sub}`;
    im.token = await encodeActivation("myserviceclient", akp, issuer, {
      subject: im.to,
      type: "service",
    }, { algorithm: Algorithms.v1 });

    ac.nats.imports = ac.nats.imports || [];
    ac.nats.imports.push(im);

    token = await encodeAccount(ac.name, akp, ac.nats, {
      algorithm: Algorithms.v1,
    });

    const ngs = new NGS(conf);
    await ngs.pushAccount(token);
    token = await ngs.getRawAccount(akp);
    await Deno.writeTextFile(assetPath(ac.name, "account.jwt"), token);
  }
  return token;
}

async function maybeAddExport(token: string, akp: KeyPair): Promise<void> {
  const ac = await decode<Account>(token);
  if (ac.nats.exports === undefined) {
    const e = {
      name: "MyService",
      subject: "q.*",
      type: "service",
      token_req: true,
    } as Export;
    e.name = "MyService";
    e.subject = "q.*";
    ac.nats.exports = [e];

    token = await encodeAccount(ac.name, akp, ac.nats, {
      algorithm: Algorithms.v1,
    });
    const ngs = new NGS(conf);
    await ngs.pushAccount(token);
    token = await ngs.getRawAccount(akp);
    await Deno.writeTextFile(assetPath(ac.name, "account.jwt"), token);
  }
  return;
}

async function maybeGenerateCreds(name: string, akp: KeyPair): Promise<void> {
  const u = createUser();
  const jwt = await encodeUser(name, u, akp, {}, {
    algorithm: Algorithms.v1,
  });

  await Deno.writeTextFile(
    assetPath(name, "user.creds"),
    new TextDecoder().decode(fmtCreds(jwt, u)),
  );
}

const service = await maybeMkAccount("service");
await maybeAddExport(service.jwt, service.key);
await maybeGenerateCreds("service", service.key);
console.log(`generated service: ${assetPath("service", "")}`);

const client = await maybeMkAccount("client");
await maybeAddImport(service.key, client.key, client.jwt);
await maybeGenerateCreds("client", service.key);
console.log(`generated client: ${assetPath("client", "")}`);
