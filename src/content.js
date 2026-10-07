(() => {
  if (window.__viewportSearch) return; // guard against double injection

  class ViewportSearch {
    constructor({ margin = 80 } = {}) {
      this.word = "";
      this.mode = "partial";
      this.ranges = [];
      this.margin = margin;
      this._raf = null;
      addEventListener("scroll", () => this._schedulePaint(), { passive: true });
      addEventListener("resize", () => this._schedulePaint());
    }

    _vh() { return window.visualViewport?.height ?? innerHeight; }
    _vw() { return window.visualViewport?.width ?? innerWidth; }

    // mode: "partial" (anywhere in a word), "prefix" (start of a word), "word" (whole word)
    search(word, mode = "partial") {
      this.clear();
      this.word = word;
      this.mode = mode;
      if (!word) return 0;

      const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      // Unicode-aware boundaries (works with ä, ö, å, ...)
      const before = mode === "partial" ? "" : "(?<![\\p{L}\\p{N}])";
      const after = mode === "word" ? "(?![\\p{L}\\p{N}])" : "";
      const regex = new RegExp(`${before}${escaped}${after}`, "giu");

      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          const el = node.parentElement;
          if (!el || el.closest("script, style, noscript, textarea")) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        },
      });

      let node;
      while ((node = walker.nextNode())) {
        let m;
        regex.lastIndex = 0;
        while ((m = regex.exec(node.nodeValue))) {
          const range = new Range();
          range.setStart(node, m.index);
          range.setEnd(node, m.index + m[0].length);
          this.ranges.push(range);
          if (m[0].length === 0) regex.lastIndex++;
        }
      }

      this._paint();
      return this._measure().length;
    }

    _measure() {
      const vh = this._vh(), vw = this._vw();
      return this.ranges
        .map((range) => {
          const rect = range.getBoundingClientRect();
          const inView = rect.bottom > 0 && rect.top < vh && rect.right > 0 && rect.left < vw;
          return { range, rect, inView };
        })
        .filter(({ rect }) => rect.width > 0 || rect.height > 0) // drops display:none
        .sort((a, b) => a.rect.top - b.rect.top || a.rect.left - b.rect.left);
    }

    _scrollTo(range, align) {
      const rect = range.getBoundingClientRect();
      // Nested scroll containers: let the browser handle them first
      const el = range.startContainer.parentElement;
      const container = el?.closest("[style*='overflow'], main, section, div");
      if (container && container.scrollHeight > container.clientHeight + 1 &&
          getComputedStyle(container).overflowY.match(/auto|scroll/)) {
        el.scrollIntoView({ block: align === "top" ? "start" : "end", behavior: "smooth" });
        return;
      }
      const top = align === "top"
        ? scrollY + rect.top - this.margin
        : scrollY + rect.bottom - this._vh() + this.margin;
      scrollTo({ top, behavior: "smooth" });
    }

    next() {
      const items = this._measure();
      if (!items.length) return null;
      const vh = this._vh();
      const target = items.find(({ rect }) => rect.top >= vh) ?? items[0]; // wrap
      this._scrollTo(target.range, "top");
      return target.range;
    }

    prev() {
      const items = this._measure();
      if (!items.length) return null;
      const above = items.filter(({ rect }) => rect.bottom <= 0);
      const target = above.length ? above[above.length - 1] : items[items.length - 1]; // wrap
      this._scrollTo(target.range, "bottom");
      return target.range;
    }

    _paint() {
      if (!CSS.highlights) return;
      const items = this._measure();
      const inView = new Highlight(...items.filter((i) => i.inView).map((i) => i.range));
      inView.priority = 1;
      CSS.highlights.set("vs-all", new Highlight(...items.map((i) => i.range)));
      CSS.highlights.set("vs-view", inView);
    }

    _schedulePaint() {
      if (this._raf || !this.ranges.length) return;
      this._raf = requestAnimationFrame(() => { this._raf = null; this._paint(); });
    }

    state() {
      const items = this._measure();
      return { word: this.word, mode: this.mode, count: items.length, inView: items.filter((i) => i.inView).length };
    }

    clear() {
      this.word = "";
      this.ranges = [];
      CSS.highlights?.delete("vs-all");
      CSS.highlights?.delete("vs-view");
    }
  }

  const finder = (window.__viewportSearch = new ViewportSearch());

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    switch (msg.type) {
      case "search": finder.search(msg.word, msg.mode); break;
      case "next":   finder.next(); break;
      case "prev":   finder.prev(); break;
      case "clear":  finder.clear(); break;
      case "state":  break;
    }
    // Give smooth scrolling a moment before reporting how many are in view
    setTimeout(() => sendResponse(finder.state()), msg.type === "next" || msg.type === "prev" ? 450 : 0);
    return true; // async response
  });
})();
