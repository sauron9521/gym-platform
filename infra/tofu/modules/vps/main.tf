locals {
  name = "ovranto-${var.environment}"
  labels = {
    project     = "ovranto"
    environment = var.environment
    managed_by  = "opentofu"
  }
}
# Deny inbound by default. Only explicitly reviewed operator IPv4 /32s can allow SSH.
resource "hcloud_firewall" "host" {
  name   = "${local.name}-firewall"
  labels = local.labels
  dynamic "rule" {
    for_each = length(var.operator_ipv4_cidrs) > 0 ? [1] : []
    content {
      direction   = "in"
      protocol    = "tcp"
      port        = "22"
      source_ips  = sort(tolist(var.operator_ipv4_cidrs))
      description = "Explicit operator SSH allowlist"
    }
  }
}
resource "hcloud_server" "host" {
  name               = local.name
  server_type        = var.server_type
  location           = var.location
  image              = "ubuntu-24.04"
  ssh_keys           = sort(tolist(var.ssh_key_ids))
  firewall_ids       = [tonumber(hcloud_firewall.host.id)]
  backups            = var.provider_backups
  delete_protection  = true
  rebuild_protection = true
  labels             = local.labels
  public_net {
    ipv4_enabled = true
    ipv6_enabled = false
  }
  lifecycle {
    prevent_destroy = true
    precondition {
      condition     = length(var.ssh_key_ids) > 0
      error_message = "An active server requires an existing environment-specific SSH key ID."
    }
    precondition {
      condition     = (var.environment == "staging" && var.server_type == "cx33") || (var.environment == "production" && var.server_type == "cx43")
      error_message = "Environment and candidate server size do not match the proposed INF01 topology."
    }
  }
}
