import {
  connect,
  credsAuthenticator,
} from "https://deno.land/x/nats/src/mod.ts";

const cd = await Deno.readFile("./service/user.creds");
const nc = await connect({
  servers: ["connect.ngs.global:4222"],
  authenticator: credsAuthenticator(cd),
  debug: true,
});

console.log("connected");
nc.subscribe(">", {
  callback: (err, msg) => {
    msg.respond(msg.data);
  },
});
