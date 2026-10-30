"use client";

import { DocHeader, DocNote } from "../components/Documentation";

import Link from "next/link";
import { Footer } from "../Footer";

interface BlogPost {
  slug: string;
  title: string;
  description: string;
  date: string;
  image: string;
}

const posts: BlogPost[] = [
  {
    slug: "layout-mode",
    title: "Introducing Layout Mode",
    description: "Show your agent where things go — drag components, rearrange sections, and wireframe pages instead of describing layouts in words.",
    date: "March 24, 2026",
    image: "/blog/layout-mode.png",
  },
  {
    slug: "introducing-agentation-2",
    title: "Introducing Agentation 2.0",
    description: "Annotations become a two-way conversation. Your AI agent can now see, respond to, and resolve your feedback in real time.",
    date: "February 5, 2026",
    image: "/blog/agentation-2.png",
  },
];

export default function BlogPage() {
  return (
    <>
      <article className="article">
        <DocHeader title="Blog" description="Announcements and updates" />

        <section>
          <div className="docs-post-list">
            {posts.map((post) => (
              <Link key={post.slug} href={`/blog/${post.slug}`} className="blog-post-card">
                <div className="docs-post-image">
                  <img src={post.image} alt={post.title} />
                </div>
                <div className="docs-post-summary">
                  <div className="docs-post-heading">
                    <h3>{post.title}</h3>
                    <time>{post.date}</time>
                  </div>
                  <DocNote>{post.description}</DocNote>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </article>

      <Footer />
    </>
  );
}
