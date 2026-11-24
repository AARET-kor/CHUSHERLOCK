# Tests never reach the Internet Archive.
from chmonitor import ch_hidden

ch_hidden.fetch_archive = lambda timeout=60: ([], [])
ch_hidden.fetch_commoncrawl = lambda timeout=90, crawls=8: ([], [])
ch_hidden.ChromeHeartsHidden.background = False
