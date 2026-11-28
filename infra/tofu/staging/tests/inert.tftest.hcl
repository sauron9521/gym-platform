mock_provider "hcloud" {}
run "inert_candidate" {
  command = plan
  assert {
    condition     = length(module.host) == 0
    error_message = "INF02 must not enable cloud resources."
  }
  assert {
    condition     = output.candidate.environment == "staging" && output.candidate.server_type == "cx33" && output.candidate.monthly_budget_eur == 50
    error_message = "Candidate profile drifted from INF01."
  }
}
