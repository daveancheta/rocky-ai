import { checkMetaModelCapabilities } from "../lib/meta-model-api"

async function main() {
  const result = await checkMetaModelCapabilities()
  console.log(JSON.stringify(result, null, 2))

  if (result.capabilities.some((capability) => capability.status === "error" || capability.status === "unavailable")) {
    process.exitCode = 1
  }
}

void main()
