"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type HeroSliderArticle = {
  id: string;
  slug: string;
  title: string;
  publishDateLabel: string;
  categories: string[];
  featuredImage: {
    url: string;
    title: string;
    width: number;
    height: number;
  } | null;
};

type HeroSliderProps = {
  articles: HeroSliderArticle[];
};

const AUTO_INTERVAL_MS = 6000;

export function HeroSlider({ articles }: HeroSliderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollAnimationRef = useRef<number | null>(null);
  const autoPlayTimeoutRef = useRef<number | null>(null);
  const programmaticScrollRef = useRef(false);
  const programmaticResetTimeoutRef = useRef<number | null>(null);
  const progressIterationRef = useRef(0);

  const clampIndex = useCallback(
    (index: number) => {
      if (articles.length === 0) return 0;
      return Math.max(0, Math.min(index, articles.length - 1));
    },
    [articles.length],
  );

  const safeActiveIndex = clampIndex(activeIndex);

  const clearAutoPlay = useCallback(() => {
    if (autoPlayTimeoutRef.current !== null) {
      window.clearTimeout(autoPlayTimeoutRef.current);
      autoPlayTimeoutRef.current = null;
    }
  }, []);

  const scrollToIndex = useCallback(
    (index: number) => {
      const container = containerRef.current;
      if (!container) return;
      const targetIndex = clampIndex(index);
      if (targetIndex === safeActiveIndex) {
        return;
      }

      setActiveIndex(targetIndex);
    },
    [clampIndex, safeActiveIndex],
  );

  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container || articles.length === 0 || programmaticScrollRef.current) {
      return;
    }

    if (scrollAnimationRef.current !== null) {
      cancelAnimationFrame(scrollAnimationRef.current);
    }

    scrollAnimationRef.current = requestAnimationFrame(() => {
      const slideWidth = container.clientWidth;
      if (slideWidth === 0) return;
      const index = Math.round(container.scrollLeft / slideWidth);
      setActiveIndex(clampIndex(index));
      scrollAnimationRef.current = null;
    });
  }, [articles.length, clampIndex]);

  const handlePrev = useCallback(() => {
    scrollToIndex(safeActiveIndex - 1);
  }, [safeActiveIndex, scrollToIndex]);

  const handleNext = useCallback(() => {
    scrollToIndex(safeActiveIndex + 1);
  }, [safeActiveIndex, scrollToIndex]);

  useEffect(() => {
    if (articles.length <= 1) {
      clearAutoPlay();
      return;
    }

    clearAutoPlay();
    autoPlayTimeoutRef.current = window.setTimeout(() => {
      const nextIndex = safeActiveIndex + 1 >= articles.length ? 0 : safeActiveIndex + 1;
      setActiveIndex(nextIndex);
    }, AUTO_INTERVAL_MS);

    return () => {
      clearAutoPlay();
    };
  }, [articles.length, safeActiveIndex, clearAutoPlay]);

  useEffect(() => {
    const handleResize = () => {
      const container = containerRef.current;
      if (!container) return;
      container.scrollTo({
        left: container.clientWidth * safeActiveIndex,
        behavior: "auto",
      });
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      if (scrollAnimationRef.current !== null) {
        cancelAnimationFrame(scrollAnimationRef.current);
      }
    };
  }, [safeActiveIndex]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const slideWidth = container.clientWidth;
    if (slideWidth === 0) return;

    programmaticScrollRef.current = true;
    container.scrollTo({
      left: slideWidth * safeActiveIndex,
      behavior: "smooth",
    });

    if (programmaticResetTimeoutRef.current !== null) {
      window.clearTimeout(programmaticResetTimeoutRef.current);
    }

    programmaticResetTimeoutRef.current = window.setTimeout(() => {
      programmaticScrollRef.current = false;
      programmaticResetTimeoutRef.current = null;
    }, 500);
  }, [safeActiveIndex]);

  useEffect(() => {
    return () => {
      clearAutoPlay();
      if (scrollAnimationRef.current !== null) {
        cancelAnimationFrame(scrollAnimationRef.current);
      }
      if (programmaticResetTimeoutRef.current !== null) {
        window.clearTimeout(programmaticResetTimeoutRef.current);
      }
    };
  }, [clearAutoPlay]);

  const progressKey = useMemo(() => {
    progressIterationRef.current += 1;
    return `${progressIterationRef.current}-${safeActiveIndex}-${articles.length}`;
  }, [articles.length, safeActiveIndex]);

  if (articles.length === 0) {
    return null;
  }

  return (
    <div className="relative hero-slider-wrapper">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="hero-slider-inner flex overflow-x-auto scroll-smooth snap-x snap-mandatory rounded-xl border border-border/70"
      >
        {articles.map((article, index) => (
          <Link
            key={article.id}
            href={`/articles/${article.slug}`}
            className="relative block aspect-[16/9] w-full flex-shrink-0 snap-start"
            aria-label={`Baca ${article.title}`}
          >
            {article.featuredImage ? (
              <Image
                src={article.featuredImage.url}
                alt={article.featuredImage.title}
                fill
                priority={index === 0}
                className="object-cover"
                sizes="(min-width: 1280px) 65vw, (min-width: 1024px) 60vw, 90vw"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 flex flex-col gap-2 p-4 text-white sm:p-6">
              {article.categories.length ? (
                <span className="text-[10px] uppercase tracking-wide text-white/80 sm:text-xs">
                  {article.categories.join(" • ")}
                </span>
              ) : null}
              <h2 className="text-xl font-semibold leading-tight sm:text-2xl">{article.title}</h2>
              <span className="text-xs text-white/70 sm:text-sm">{article.publishDateLabel}</span>
            </div>
          </Link>
        ))}
      </div>

      {articles.length > 1 ? (
        <>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 overflow-hidden bg-black/30">
            <div
              key={`progress-${progressKey}`}
              className="hero-slider-progress-bar h-full bg-white/80"
              style={{ ["--hero-slider-duration" as string]: `${AUTO_INTERVAL_MS}ms` }}
            />
          </div>

          <div className="pointer-events-none absolute inset-0 hidden items-center justify-between px-3 sm:flex">
            <button
              type="button"
              onClick={handlePrev}
              disabled={safeActiveIndex === 0}
              className="pointer-events-auto inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/70 text-white shadow-lg transition hover:bg-black/80 disabled:opacity-30"
              aria-label="Artikel sebelumnya"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              onClick={handleNext}
              disabled={safeActiveIndex === articles.length - 1}
              className="pointer-events-auto inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/70 text-white shadow-lg transition hover:bg-black/80 disabled:opacity-30"
              aria-label="Artikel berikutnya"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/60 px-3 py-1 text-xs text-white shadow-lg backdrop-blur">
            {articles.map((_, index) => (
              <span
                key={`indicator-${index}`}
                className="flex h-1.5 w-4 overflow-hidden rounded-full bg-white/40"
              >
                <span
                  className="h-full w-full origin-left scale-x-0 rounded-full bg-white transition-transform duration-300"
                  style={{
                    transform: index === safeActiveIndex ? "scaleX(1)" : "scaleX(0)",
                  }}
                />
              </span>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
