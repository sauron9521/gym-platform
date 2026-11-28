mock_provider "hcloud" {
  mock_resource "hcloud_firewall" {
    defaults = { id = "456" }
  }
}
variables {
  environment = "staging"
  location    = "nbg1"
  server_type = "cx33"
  ssh_key_ids = ["123"]
}
run "staging_candidate" {
  command = plan
  assert {
    condition     = hcloud_server.host.name == "ovranto-staging" && hcloud_server.host.server_type == "cx33"
    error_message = "Staging identity or size is wrong."
  }
  assert {
    condition     = hcloud_server.host.delete_protection && hcloud_server.host.rebuild_protection && !hcloud_server.host.backups
    error_message = "Protection or optional backup default is wrong."
  }
  assert {
    condition     = length(hcloud_firewall.host.rule) == 0 && hcloud_firewall.host.labels.environment == "staging"
    error_message = "Firewall must deny inbound by default and be environment-scoped."
  }
  assert {
    condition     = one(hcloud_server.host.public_net).ipv4_enabled && !one(hcloud_server.host.public_net).ipv6_enabled
    error_message = "Unexpected public network settings."
  }
}
run "production_candidate" {
  command = plan
  variables {
    environment = "production"
    location    = "fsn1"
    server_type = "cx43"
  }
  assert {
    condition     = hcloud_server.host.name == "ovranto-production" && hcloud_server.host.location == "fsn1" && hcloud_server.host.server_type == "cx43" && hcloud_firewall.host.labels.environment == "production"
    error_message = "Production candidate does not match the isolated German topology."
  }
}
run "reject_other_region" {
  command = plan
  variables {
    location = "hel1"
  }
  expect_failures = [var.location]
}
run "reject_missing_key" {
  command = plan
  variables {
    ssh_key_ids = []
  }
  expect_failures = [hcloud_server.host]
}
run "reject_wrong_size" {
  command = plan
  variables {
    environment = "production"
  }
  expect_failures = [hcloud_server.host]
}
