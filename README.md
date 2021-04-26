# Sample of Service

Here's an automated flow of creating an account and assigning an import. To
create the environment, you'll need to first apply the following patch to the
ngsapi-js library I shared with you earlier.

Apply this patch to the assets I shared with you earlier:

```
Index: tests/util.ts
IDEA additional info:
Subsystem: com.intellij.openapi.diff.impl.patch.CharsetEP
<+>UTF-8
===================================================================
diff --git a/tests/util.ts b/tests/util.ts
--- a/tests/util.ts	(revision 698c2e114ec98430673966244b9e16aa0a2efea8)
+++ b/tests/util.ts	(date 1619472710646)
@@ -12,8 +12,10 @@
   } else {
     const d = await Deno.readTextFile("./test.env");
     const env = JSON.parse(d) as Env;
-    env.adminSeed = await getAdminSeed(env.adminSeed ?? "");
-    env.adminCreds = await getAdminCreds(env.adminCreds ?? "");
+    if(env.adminSeed) {
+      env.adminSeed = await getAdminSeed(env.adminSeed ?? "");
+      env.adminCreds = await getAdminCreds(env.adminCreds ?? "");
+    }
     return new Env(env);
   }
 }
```

## Setup

```bash
deno run -A --unstable setup.ts
```

setup.ts creates two account JWTs:

- The `service`, which will respond to requests
- The `client`, which will use a service exported by `service`

Each of the entities will be created as on the current directory.

## Run the service and client

```bash
deno run -A --unstable service.ts
```

```bash
deno run -A --unstable client.ts
```

## Running via a leaf-node

To run with a leaf-node, you'll have to upgrade your account to a developer
program, to do this let's grab the generated assets:

```bash
# verify where nsc is storing stuff - note where the `Stores Dir lives`
nsc env

# to change the store (use nsc env -s to the dir you copied above to 
# return your env to your pre-test settings) - just make sure to close
# the shell to remove any exports, etc that are done below
nsc env -s /tmp/work

# install the synadia operator on the store
nsc add operator -u synadia

# copy the service assets
cp -R leafnode/service /tmp/work
nsc fix --in /tmp/work --out /tmp/merged

# change the store again to the merged operator store
nsc env -s /tmp/merged/operators

export NKEYS_PATH=/tmp/merged/keys

# use ngs tool to register the service account
ngs edit -d /tmp/merged/operators/synadia
```

After you registered to the free developer plan, you should be able to connect a
leaf node.

Edit ./nats.conf to have an absolute path for the creds path you generated

```
leafnodes {
  remotes = [
    {
      url: "tls://connect.ngs.global"
      # MAKE THIS PATH ABSOLUTE
      credentials: "./service/user.creds"
    },
  ]
}
```

Then:

```bash
nats-server -c nats.conf
```

If you look at `service_via_leafnode.ts` it connects to the local host, but the
server is connected to ngs:

```bash
deno run -A --unstable service_via_leafnode.ts
```

Run the client again

```bash
deno run -A --unstable client.ts
```

## What does all this mean

The point illustrated here is that the service side of things can connect
directly to NGS or through a leaf node.

A leaf node simply bridges authentication domains, connections to the leafnode
from the internal network used no credentials (you can add them if you want),
they simply subscribed locally, and data to and from the `service` account
bridged transparently to the `client` account.

In terms of configuration, the actual complexity is on vending the service out,
and generating the import tokens.

The service simply exports `q.*` - the wildcard is a placeholder for an account
and provides the isolation to other service importers.

The service import is generated per client account. It sets the subject by which
the client can access the service to `q.<account_id>`. It then aliases it to
`q`. The client simply makes requests to `q`, but the request is actually
`q.<account_id>`. You can print the subject of inbound messages to see it flow
through. Other clients won't be able to publish on a subject clamped to a
different account.

The ability to clamp each client account to its own subject also gives you a
handle to identify the account making the request on the service side.
