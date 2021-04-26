import {
  connect,
  credsAuthenticator,
  JSONCodec,
} from "https://deno.land/x/nats/src/mod.ts";

const cd = await Deno.readTextFile("./client/user.creds");
const nc = await connect({
  servers: ["connect.ngs.global:4222"],
  authenticator: credsAuthenticator(new TextEncoder().encode(cd)),
});

console.log("connected");

const jc = JSONCodec();
let i = 0;
setInterval(async () => {
  const d = await nc.request("q", jc.encode({hello: "world", counter: i++}));
  console.log(jc.decode(d.data));
}, 1000);

await nc.closed;
