import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

interface MarkdownRendererProps {
  content: string;
  className?: string;
  previewMode?: boolean;
}

/**
 * Renders Markdown content with support for:
 * - GitHub Flavored Markdown (tables, strikethrough, task lists, autolinks)
 * - LaTeX / MathJax math expressions (inline `$...$` and block `$$...$$`)
 * - Code blocks with syntax highlighting tokens
 */
const MarkdownRenderer = ({ content, className = "", previewMode = false }: MarkdownRendererProps) => {
  return (
    <div className={`markdown-body ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          // Headings
          h1: ({ children }) => (
            <h1 className={`${previewMode ? 'text-sm text-muted-foreground font-semibold inline mr-2' : 'text-xl font-bold text-foreground mt-6 mb-3 first:mt-0'}`}>{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className={`${previewMode ? 'text-sm text-muted-foreground font-semibold inline mr-2' : 'text-lg font-semibold text-foreground mt-5 mb-2'}`}>{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className={`${previewMode ? 'text-sm text-muted-foreground font-medium inline mr-2' : 'text-base font-semibold text-foreground mt-4 mb-2'}`}>{children}</h3>
          ),
          // Paragraph
          p: ({ children }) => (
            <p className={`${previewMode ? 'text-sm text-muted-foreground inline mr-1' : 'text-foreground leading-relaxed mb-3 last:mb-0'}`}>{children}</p>
          ),
          // Lists
          ul: ({ children }) => (
            <ul className={`${previewMode ? 'inline mr-1' : 'list-disc list-inside text-foreground mb-3 space-y-1 pl-1'}`}>{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className={`${previewMode ? 'inline mr-1' : 'list-decimal list-inside text-foreground mb-3 space-y-1 pl-1'}`}>{children}</ol>
          ),
          li: ({ children }) => (
            <li className={`${previewMode ? 'inline mr-1 after:content-[",_"] last:after:content-[""]' : 'text-foreground'}`}>{children}</li>
          ),
          // Code (inline & block)
          code: ({ className: codeClassName, children, ...props }) => {
            const isBlock = codeClassName?.startsWith("language-");
            if (isBlock) {
              return (
                <code className={`${codeClassName} text-xs`} {...props}>
                  {children}
                </code>
              );
            }
            return (
              <code
                className={`px-1 rounded bg-muted text-xs font-mono ${previewMode ? 'text-muted-foreground' : 'text-foreground'}`}
                {...props}
              >
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className={`${previewMode ? 'inline text-muted-foreground mx-1' : 'bg-muted rounded-lg p-4 overflow-x-auto mb-3 text-sm font-mono'}`}>
              {children}
            </pre>
          ),
          // Blockquote
          blockquote: ({ children }) => (
            <blockquote className={`${previewMode ? 'inline italic text-muted-foreground mr-1' : 'border-l-4 border-primary/40 pl-4 py-1 my-3 text-muted-foreground italic'}`}>
              {children}
            </blockquote>
          ),
          // Table
          table: ({ children }) => (
            previewMode ? <span className="text-muted-foreground italic mr-1">[Table]</span> :
            <div className="overflow-x-auto mb-3">
              <table className="min-w-full border border-border rounded-lg text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-muted">{children}</thead>
          ),
          th: ({ children }) => (
            <th className="px-3 py-2 text-left font-semibold text-foreground border-b border-border">{children}</th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-2 text-foreground border-b border-border">{children}</td>
          ),
          // Link
          a: ({ href, children }) => (
            <a
              href={previewMode ? undefined : href}
              target={previewMode ? undefined : "_blank"}
              rel="noopener noreferrer"
              className={previewMode ? "text-muted-foreground pointer-events-none" : "text-primary hover:underline"}
            >
              {children}
            </a>
          ),
          // Horizontal rule
          hr: () => <hr className={`${previewMode ? 'hidden' : 'my-4 border-border'}`} />,
          // Strong & emphasis
          strong: ({ children }) => (
            <strong className={`font-semibold ${previewMode ? 'text-muted-foreground' : 'text-foreground'}`}>{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic">{children}</em>
          ),
          // Images
          img: ({ src, alt }) => (
            previewMode ? <span className="text-muted-foreground italic mr-1">[Image: {alt}]</span> :
            <img
              src={src}
              alt={alt || ""}
              className="max-w-full rounded-lg my-3"
              loading="lazy"
            />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer;
