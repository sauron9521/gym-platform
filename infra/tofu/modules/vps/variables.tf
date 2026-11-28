variable "environment" {
  type = string
  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "Only isolated staging and production are supported."
  }
}
variable "location" {
  type = string
  validation {
    condition     = contains(["fsn1", "nbg1"], var.location)
    error_message = "INF01 permits German locations only."
  }
}
variable "server_type" {
  type = string
  validation {
    condition     = contains(["cx33", "cx43"], var.server_type)
    error_message = "Only the proposed AMD64 candidate SKUs are permitted."
  }
}
variable "ssh_key_ids" {
  type = set(string)
  validation {
    condition     = alltrue([for id in var.ssh_key_ids : can(regex("^[0-9]+$", id))])
    error_message = "SSH key IDs must be numeric."
  }
}
variable "provider_backups" {
  type    = bool
  default = false
}
