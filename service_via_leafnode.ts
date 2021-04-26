import { connect } from "https://deno.land/x/nats/src/mod.ts";

const nc = await connect({
  port: 4222,
});

console.log("connected");

const sub = nc.subscribe(">", {
  callback: (err, msg) => {
    console.log(sub.getProcessed());
    msg.respond(msg.data);
  },
});
