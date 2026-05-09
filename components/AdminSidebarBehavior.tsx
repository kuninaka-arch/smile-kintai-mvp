"use client";

import { useEffect } from "react";

const scrollKey = "smile-admin-sidebar-scroll";
const sectionKeyPrefix = "smile-admin-sidebar-section:";

export function AdminSidebarBehavior() {
  useEffect(() => {
    const nav = document.querySelector<HTMLElement>("[data-admin-menu-nav]");
    if (!nav) return;

    const activeItem = nav.querySelector<HTMLElement>("[data-admin-menu-active='true']");
    const savedScroll = sessionStorage.getItem(scrollKey);
    if (savedScroll) {
      nav.scrollTop = Number(savedScroll);
    }

    const sections = Array.from(nav.querySelectorAll<HTMLDetailsElement>("details[data-admin-sidebar-section]"));
    const cleanupSections: Array<() => void> = [];

    sections.forEach((section) => {
      const sectionId = section.dataset.adminSidebarSection;
      if (!sectionId) return;

      const storageKey = `${sectionKeyPrefix}${sectionId}`;
      const savedOpen = sessionStorage.getItem(storageKey);
      const containsActive = Boolean(section.querySelector("[data-admin-menu-active='true']"));

      if (savedOpen !== null) {
        section.open = savedOpen === "true";
      }
      if (containsActive) {
        section.open = true;
      }

      const onToggle = () => {
        sessionStorage.setItem(storageKey, String(section.open));
      };
      section.addEventListener("toggle", onToggle);
      cleanupSections.push(() => section.removeEventListener("toggle", onToggle));
    });

    requestAnimationFrame(() => {
      if (!activeItem) return;
      const navRect = nav.getBoundingClientRect();
      const activeRect = activeItem.getBoundingClientRect();
      const isVisible = activeRect.top >= navRect.top + 24 && activeRect.bottom <= navRect.bottom - 24;
      if (!isVisible) {
        activeItem.scrollIntoView({ block: "center" });
      }
    });

    const onScroll = () => {
      sessionStorage.setItem(scrollKey, String(nav.scrollTop));
    };
    nav.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      nav.removeEventListener("scroll", onScroll);
      cleanupSections.forEach((cleanup) => cleanup());
    };
  }, []);

  return null;
}
