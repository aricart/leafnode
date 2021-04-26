import {
  connect,
  credsAuthenticator,
  JSONCodec,
} from "https://deno.land/x/nats/src/mod.ts";

const cd = await Deno.readTextFile("./service/user.creds");
const nc = await connect({
  servers: ["connect.ngs.synadia-test.com:4222"],
  authenticator: credsAuthenticator(new TextEncoder().encode(cd)),
  debug: true,
});

console.log("connected");
nc.subscribe(">", {
  callback: (err, msg) => {
    msg.respond(msg.data);
  },
});
