"""Keep HACS publication checks enabled in the required CI chain."""

from pathlib import Path
import re
import unittest


class HacsValidationContractTests(unittest.TestCase):
    def test_required_hacs_job_does_not_exempt_publication_checks(self):
        source = (Path(__file__).resolve().parents[1]
                  / ".github/workflows/repository-checks.yml").read_text()
        hacs = re.search(r"^  hacs:\n(.*?)(?=^  [\w-]+:|\Z)", source, re.M | re.S)
        self.assertIsNotNone(hacs, "Required HACS job must exist")
        self.assertRegex(hacs.group(1), r"(?m)^      - uses: hacs/action@")
        self.assertRegex(hacs.group(1), r"(?m)^          category: integration$")
        self.assertNotRegex(hacs.group(1), r"(?m)^\s+ignore:",
                            "HACS must validate topics and all publication checks")


if __name__ == "__main__":
    unittest.main()
