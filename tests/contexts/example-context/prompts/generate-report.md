---
name: generate_report
description: Generates a report in the specified format
---
# Report Generation Request

Please generate a **{{format}}** report about **{{topic}}** with **{{detailLevel}}** detail.

{% if maxPages %}
Keep the report within **{{maxPages}}** pages.
{% endif %}
