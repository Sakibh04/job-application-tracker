"""Run with Flask and Playwright installed; uses Chrome and a temporary database."""
import os
from pathlib import Path
import sys
import tempfile
import threading

from playwright.sync_api import sync_playwright, expect
from werkzeug.serving import make_server

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import app as tracker


def run():
    with tempfile.TemporaryDirectory(prefix='job-tracker-test-') as directory:
        original_database = tracker.DATABASE
        tracker.DATABASE = str(Path(directory) / 'test.db')
        tracker.init_db()
        server = make_server('127.0.0.1', 0, tracker.app)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            with sync_playwright() as playwright:
                browser = playwright.chromium.launch(channel='chrome', headless=True)
                page = browser.new_page(viewport={'width': 1440, 'height': 1050})
                errors = []
                page.on('pageerror', lambda error: errors.append(str(error)))
                base = f'http://127.0.0.1:{server.server_port}'
                page.clock.install()
                page.goto(base)
                expect(page.get_by_role('heading', name='Your next move, in focus.')).to_be_visible()
                # Backgrounds rotate, allow manual selection, and respect reduced motion.
                page.wait_for_function("[...document.querySelectorAll('.hero-photo')].every(img => img.complete && img.naturalWidth > 0)")
                page.clock.fast_forward(7000)
                expect(page.locator('[data-slide="1"]')).to_have_attribute('aria-pressed', 'true')
                expect(page.locator('.feature-grid, .landing-footer, #slideshowToggle')).to_have_count(0)
                page.locator('[data-slide="2"]').click()
                expect(page.locator('[data-slide="2"]')).to_have_attribute('aria-pressed', 'true')
                page.clock.fast_forward(7000)
                expect(page.locator('[data-slide="0"]')).to_have_attribute('aria-pressed', 'true')
                page.emulate_media(reduced_motion='reduce')
                page.clock.fast_forward(14000)
                expect(page.locator('[data-slide="0"]')).to_have_attribute('aria-pressed', 'true')
                page.locator('[data-slide="2"]').click()
                expect(page.locator('[data-slide="2"]')).to_have_attribute('aria-pressed', 'true')
                page.locator('[data-slide="0"]').click()
                page.emulate_media(reduced_motion='no-preference')
                page.clock.resume()
                screenshots = os.environ.get('SCREENSHOT_DIR')
                if screenshots:
                    Path(screenshots).mkdir(parents=True, exist_ok=True)
                    page.screenshot(path=f'{screenshots}/landing-desktop.png', full_page=True, animations='disabled')
                    for index in [1, 2]:
                        page.locator(f'[data-slide="{index}"]').click()
                        expect(page.locator(f'[data-slide="{index}"]')).to_have_attribute('aria-pressed', 'true')
                        page.screenshot(path=f'{screenshots}/landing-photo-{index + 1}.png', full_page=True, animations='disabled')
                    page.locator('[data-slide="0"]').click()
                page.get_by_role('button', name='Create an account', exact=True).click()
                page.locator('#registerEmail').fill('browser-test@example.test')
                page.locator('#registerUsername').fill('browser-test')
                page.locator('#registerPassword').fill('testing-password')
                page.locator('#registerConfirm').fill('wrong-password')
                page.get_by_role('button', name='Create account', exact=True).click()
                expect(page.locator('#registerError')).to_have_text('Passwords do not match.')
                page.locator('#registerConfirm').fill('testing-password')
                page.get_by_role('button', name='Create account', exact=True).click()
                page.wait_for_url('**/dashboard')
                expect(page.locator('#count-all')).to_have_text('00')
                expect(page.locator('#emptyState')).to_be_visible()
                page.get_by_role('button', name='Add application', exact=True).first.click()
                expect(page.locator('#jobModal')).to_be_visible()
                page.keyboard.press('Escape')
                expect(page.locator('#jobModal')).not_to_be_visible()
                # Explicit test fixtures, kept out of the real application database.
                for company, role, status in [('Example Studio', 'Product designer', 'applied'), ('Test Research', 'Frontend engineer', 'interview'), ('Sample Labs', 'UX engineer', 'offer')]:
                    page.get_by_role('button', name='Add application', exact=True).first.click()
                    page.locator('#company').fill(company)
                    page.locator('#position').fill(role)
                    page.locator('#status').select_option(status)
                    page.locator('#jobUrl').fill('https://example.com/jobs')
                    page.locator('#salary').fill('€50,000–€65,000')
                    page.locator('#notes').fill('Browser test application.')
                    page.get_by_role('button', name='Save application').click()
                    expect(page.locator('#jobModal')).not_to_be_visible()
                    expect(page.get_by_text(company, exact=True)).to_be_visible()
                expect(page.locator('#count-all')).to_have_text('03')
                expect(page.locator('#count-interview')).to_have_text('01')
                if screenshots:
                    page.screenshot(path=f'{screenshots}/dashboard-desktop.png', full_page=True, animations='disabled')
                page.locator('[data-status="interview"]').click()
                expect(page.locator('#jobTableBody tr')).to_have_count(1)
                page.locator('#searchInput').fill('does not exist')
                expect(page.locator('#emptyTitle')).to_have_text('No matching applications.')
                page.locator('#emptyAction').click()
                expect(page.locator('#jobTableBody tr')).to_have_count(3)
                page.get_by_role('button', name='Company', exact=True).click()
                expect(page.locator('th[data-column="company"]')).to_have_attribute('aria-sort', 'ascending')
                page.get_by_role('button', name='Edit Product designer at Example Studio').click()
                expect(page.locator('#notes')).to_have_value('Browser test application.')
                page.locator('#status').select_option('interview')
                page.get_by_role('button', name='Save application').click()
                expect(page.locator('#count-interview')).to_have_text('02')
                with page.expect_download() as download_info:
                    page.get_by_role('button', name='Export CSV', exact=True).click()
                downloaded = download_info.value
                assert 'Example Studio' in Path(downloaded.path()).read_text()
                page.get_by_role('button', name='Delete UX engineer at Sample Labs').click()
                page.get_by_role('button', name='Cancel', exact=True).click()
                expect(page.locator('#jobTableBody tr')).to_have_count(3)
                page.get_by_role('button', name='Delete UX engineer at Sample Labs').click()
                page.get_by_role('button', name='Delete application', exact=True).click()
                expect(page.locator('#count-all')).to_have_text('02')
                for width in [390, 768]:
                    page.set_viewport_size({'width': width, 'height': 844})
                    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), f'Dashboard overflow at {width}'
                    if screenshots:
                        page.screenshot(path=f'{screenshots}/dashboard-{width}.png', full_page=True, animations='disabled')
                page.get_by_role('button', name='Sign out').click()
                page.wait_for_url(base + '/')
                for width in [390, 768]:
                    page.set_viewport_size({'width': width, 'height': 844})
                    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), f'Landing overflow at {width}'
                    if screenshots:
                        page.screenshot(path=f'{screenshots}/landing-{width}.png', full_page=True, animations='disabled')
                page.get_by_role('button', name='Sign in', exact=True).first.click()
                page.locator('#loginUsername').fill('browser-test')
                page.locator('#loginPassword').fill('wrong-password')
                page.locator('#loginForm button[type="submit"]').click()
                expect(page.locator('#loginError')).to_have_text('Invalid username/email or password')
                page.locator('#loginPassword').fill('testing-password')
                page.locator('#loginForm button[type="submit"]').click()
                page.wait_for_url('**/dashboard')
                expect(page.locator('#jobTableBody tr')).to_have_count(2)
                # A failed request must show recovery UI rather than an empty success state.
                page.route('**/api/jobs', lambda route: route.fulfill(status=500, json={'error': 'Test failure'}))
                page.reload()
                expect(page.locator('#loadError')).to_be_visible()
                page.unroute('**/api/jobs')
                page.get_by_role('button', name='Try again').click()
                expect(page.locator('#jobTableBody tr')).to_have_count(2)
                expect(page.locator('#loadError')).not_to_be_visible()
                assert not errors, errors
                browser.close()
                print('PASS: auth, CRUD, search, filters, sorting, CSV, error recovery, and responsive layouts, and slideshow controls/reduced motion')
        finally:
            server.shutdown()
            thread.join()
            tracker.DATABASE = original_database


if __name__ == '__main__':
    run()
