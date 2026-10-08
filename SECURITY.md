# Security Policy

## Current status: unfunded, best-effort only

follow-redirects is downloaded more than 400 million times per month
and maintained by one volunteer.
**There is currently no funding for any work,**
so security reports are handled on a best-effort basis
with **no guaranteed response time, fix time, or release schedule.**

If your organization depends on follow-redirects
and needs a guaranteed response to vulnerabilities
(for example, for EU Cyber Resilience Act obligations),
see [Funded security support](#funded-security-support) below.

## Supported versions

Only the latest published version can receive fixes.
There are no backports to older major or minor versions.

## Reporting a vulnerability

Report privately via
[GitHub Security Advisories](https://github.com/follow-redirects/follow-redirects/security/advisories/new).
Do not open public issues or pull requests for security problems.

To be considered, a report **must** include:

1. The affected version(s) of follow-redirects and Node.js.
2. A minimal, self-contained proof of concept
   that runs against a local server (no external hosts)
   and demonstrates the issue with follow-redirects' default
   or documented options.
3. A concrete description of the impact:
   what an attacker can do, and under which preconditions.

Reports without a working proof of concept will be closed without review.
This includes output from scanners, fuzzers, and AI tools
that has not been verified by the reporter.
If you used such tools, say so, and confirm that you
reproduced the issue yourself.

## Scope

follow-redirects follows HTTP(S) redirects on top of Node's `http` and `https` modules.
Its security responsibility is limited to what it does during redirection.

**In scope**, for example:

- Credentials or sensitive headers (such as `Authorization`, `Cookie`, `Proxy-Authorization`)
  being forwarded to a different host, or over a downgraded protocol, contrary to documented behavior.
- Headers listed in the `sensitiveHeaders` option not being removed when they should be.
- `maxRedirects` or `maxBodyLength` limits being bypassed.
- Redirect URL handling that sends a request to a different host than the `Location` header specifies.

**Out of scope**, for example:

- Anything in the browser (this package does not work in browsers).
- Server-side request forgery (SSRF) when an application passes untrusted URLs.
  follow-redirects does not filter destinations;
  applications that need this must validate targets themselves,
  for instance in a `beforeRedirect` callback.
- Custom application headers carrying secrets that are not listed in `sensitiveHeaders`.
- Resource usage within the configured `maxRedirects` and `maxBodyLength` limits.
- Behavior of Node.js core modules, custom protocol implementations passed to `wrap()`,
  or dependencies such as `debug`.
- Issues that require an attacker to already control the application's code, configuration, or request options.

## Disclosure

Accepted reports are published as GitHub Security Advisories,
and CVEs are requested through GitHub.
Because there is no funded capacity,
fixes may take a long time or may not happen.
If you have received no response within 90 days,
you may disclose the issue publicly.
Please give downstream projects a reasonable warning first.

## Funded security support

Organizations that need a dependable security process for follow-redirects,
such as response-time commitments, prioritized fixes, or early notification of advisories,
can fund that work:

- [Sponsor on GitHub](https://github.com/sponsors/RubenVerborgh)
- Contact the author for a security support agreement or invoice-based funding.

Once funding is in place, this policy will be updated with concrete response times.
