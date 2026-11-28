locals {
  candidate = {
    environment        = "staging"
    location           = "nbg1"
    server_type        = "cx33"
    monthly_budget_eur = 50
  }
}
# Deliberately inert. INF02 does not authorize a real plan/apply or state backend.
# Removing count = 0 requires a separate reviewed implementation and owner decision.
module "host" {
  count       = 0
  source      = "../modules/vps"
  environment = local.candidate.environment
  location    = local.candidate.location
  server_type = local.candidate.server_type
  ssh_key_ids = []
}
output "candidate" {
  value = local.candidate
}
