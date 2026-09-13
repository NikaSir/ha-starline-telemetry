"""Offline regression coverage for the pinned documentation baseline."""
import hashlib
import importlib.util
import json
from pathlib import Path
import shutil
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
EXPECTED = {'standard': 'e150c4ce087635c0cbc25031a6ce1b8489ba0902da3745335af88457484963dc', 'navigation_contract': '04c81cb498de3bd9ac35b7e70ed8a90fa4376ed3a31bcedb1fe5cc3cb53e05a6'}

class StandardDocumentSyncTests(unittest.TestCase):
    def test_production_documents_match_authority(self):
        declaration = json.loads((ROOT / '.nikas-ui-standard.json').read_text())
        for key, expected in EXPECTED.items():
            with self.subTest(document=key):
                actual = hashlib.sha256((ROOT / declaration[key + '_path']).read_bytes()).hexdigest()
                self.assertEqual(actual, expected)
                self.assertEqual(declaration[key + '_sha256'], expected)

    def test_checker_rejects_independent_and_coordinated_drift(self):
        path = ROOT / 'scripts/check_standard_documents.py'
        if not path.exists():
            self.skipTest('checker will be introduced with the fix')
        spec = importlib.util.spec_from_file_location('standard_document_checker', path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        for mutation in ('document', 'declaration', 'both', 'missing', 'version'):
            with self.subTest(mutation=mutation), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                declaration = json.loads((ROOT / '.nikas-ui-standard.json').read_text())
                for key in EXPECTED:
                    target = root / declaration[key + '_path']
                    target.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copyfile(ROOT / declaration[key + '_path'], target)
                manifest = root / '.nikas-ui-standard.json'
                manifest.write_text(json.dumps(declaration))
                self.assertEqual(module.validate(root), [])
                document = root / declaration['standard_path']
                if mutation in ('document', 'both'):
                    document.write_text('obsolete baseline')
                if mutation == 'declaration':
                    declaration['standard_sha256'] = '0' * 64
                if mutation == 'both':
                    declaration['standard_sha256'] = hashlib.sha256(document.read_bytes()).hexdigest()
                if mutation == 'missing':
                    document.unlink()
                if mutation == 'version':
                    declaration['version'] = '0.0'
                manifest.write_text(json.dumps(declaration))
                self.assertTrue(module.validate(root))

if __name__ == '__main__':
    unittest.main()
