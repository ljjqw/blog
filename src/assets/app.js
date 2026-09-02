/* ============================================================
   文档站前端交互：主题切换 / Ctrl+K 搜索 / TOC 平滑滚动
   ============================================================ */
(function () {
  var root = document.documentElement;

  // ---- 主题切换（持久化到 localStorage）----
  var saved = localStorage.getItem('theme');
  if (saved) root.dataset.theme = saved;
  var toggle = document.getElementById('themeToggle');
  if (toggle) {
    toggle.addEventListener('click', function () {
      var next = root.dataset.theme === 'light' ? 'dark' : 'light';
      root.dataset.theme = next;
      localStorage.setItem('theme', next);
    });
  }

  // ---- 侧边栏搜索（过滤文档树）----
  var search = document.getElementById('searchInput');
  if (search) {
    // Ctrl+K / Cmd+K 聚焦搜索框
    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        search.focus();
        search.select();
      }
    });

    search.addEventListener('input', function () {
      var q = search.value.trim().toLowerCase();
      var groups = Array.prototype.slice.call(document.querySelectorAll('.sidebar .nav-group'));
      var rootLeaves = Array.prototype.slice.call(document.querySelectorAll('.sidebar > .nav-link'));

      if (!q) {
        groups.forEach(function (g) { g.style.display = ''; g.open = true; });
        rootLeaves.forEach(function (l) { l.style.display = ''; });
        return;
      }

      groups.forEach(function (g) {
        var links = g.querySelectorAll('.nav-link');
        var any = false;
        links.forEach(function (l) {
          var hit = l.textContent.toLowerCase().indexOf(q) !== -1;
          l.style.display = hit ? '' : 'none';
          if (hit) any = true;
        });
        g.style.display = any ? '' : 'none';
        if (any) g.open = true;
      });

      rootLeaves.forEach(function (l) {
        var hit = l.textContent.toLowerCase().indexOf(q) !== -1;
        l.style.display = hit ? '' : 'none';
      });
    });
  }

  // ---- TOC 平滑滚动 + 高亮当前章节 ----
  var tocLinks = Array.prototype.slice.call(document.querySelectorAll('.toc a'));
  if (tocLinks.length) {
    tocLinks.forEach(function (a) {
      a.addEventListener('click', function (e) {
        var id = a.getAttribute('href').slice(1);
        var el = document.getElementById(id);
        if (el) {
          e.preventDefault();
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });

    var headings = tocLinks
      .map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); })
      .filter(Boolean);
    if ('IntersectionObserver' in window && headings.length) {
      var observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              tocLinks.forEach(function (l) { l.classList.remove('on'); });
              var active = tocLinks.filter(function (l) {
                return l.getAttribute('href') === '#' + entry.target.id;
              })[0];
              if (active) active.classList.add('on');
            }
          });
        },
        { rootMargin: '0px 0px -70% 0px', threshold: 0 }
      );
      headings.forEach(function (h) { observer.observe(h); });
    }
  }
})();
