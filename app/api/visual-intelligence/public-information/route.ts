import { auth } from "@/lib/auth"
import { searchPublicInformation } from "@/lib/meta-model-api"
import { createPublicInformationSearchHandler } from "@/lib/public-information"

export const POST = createPublicInformationSearchHandler({
  getSession: (requestHeaders) => auth.api.getSession({ headers: requestHeaders }),
  provider: { search: searchPublicInformation },
  logError: (entry) => console.error(JSON.stringify(entry)),
})
