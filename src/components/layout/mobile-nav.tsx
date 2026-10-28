"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { LinkButton } from "@/components/ui/link-button";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { authLinks, navLinks } from "@/lib/site";

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            variant="ghost"
            size="icon-lg"
            className="md:hidden"
            aria-label="Open menu"
          />
        }
      >
        <Menu className="size-5" />
      </SheetTrigger>
      <SheetContent side="right" className="bg-canvas p-0">
        <SheetHeader className="border-b border-border px-6 py-5">
          <SheetTitle className="font-display text-xl text-teal-900">
            Medoras
          </SheetTitle>
        </SheetHeader>
        <nav aria-label="Mobile" className="flex flex-col px-3 py-4">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={close}
              className="rounded-lg px-3 py-3 text-base font-medium text-teal-900 transition-colors hover:bg-teal-50"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-3 border-t border-border p-6">
          <LinkButton
            href={authLinks.signIn}
            onClick={close}
            variant="outline"
            className="h-11 text-base"
          >
            Sign In
          </LinkButton>
          <LinkButton
            href={authLinks.join}
            onClick={close}
            className="h-11 text-base"
          >
            Join Medoras
          </LinkButton>
        </div>
      </SheetContent>
    </Sheet>
  );
}
