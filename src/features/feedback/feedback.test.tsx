import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FeedbackPanel } from "@/features/feedback/components/feedback-panel";
import { productbridgeLinks } from "@/features/feedback/config";

describe("FeedbackPanel", () => {
  it("links to the ProductBridge portal, roadmap and changelog in new tabs", () => {
    render(<FeedbackPanel links={productbridgeLinks("org_123")} />);
    const feedback = screen.getByRole("link", { name: /share feedback/i });
    expect(feedback).toHaveAttribute("href", "https://app.productbridge.io/widget/org_123?tab=feedback");
    expect(feedback).toHaveAttribute("target", "_blank");
    expect(feedback).toHaveAttribute("rel", expect.stringContaining("noopener"));
    expect(screen.getByRole("link", { name: /public roadmap/i })).toHaveAttribute(
      "href",
      "https://app.productbridge.io/widget/org_123?tab=roadmap",
    );
    expect(screen.getByRole("link", { name: /what's new/i })).toBeInTheDocument();
  });

  it("falls back to the contact page when ProductBridge is not configured", () => {
    render(<FeedbackPanel links={null} />);
    expect(screen.getByText(/isn.t connected yet/i)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /share feedback/i })).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /contact page/i }).length).toBeGreaterThan(0);
  });

  it("keeps product feedback separate from safety reports and warns against sharing patient information", () => {
    render(<FeedbackPanel links={null} />);
    expect(screen.getByRole("heading", { name: /reporting a person or a post/i })).toBeInTheDocument();
    expect(screen.getByText(/reporting tools are not built yet/i)).toBeInTheDocument();
    expect(screen.getByText(/don.t include patient or client information/i)).toBeInTheDocument();
    expect(screen.getByText(/does not send it your profile/i)).toBeInTheDocument();
  });
});
