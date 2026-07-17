import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownMessageProps {
  content: string;
}

/** Safe Markdown presentation for model output. Raw HTML stays escaped. */
export const MarkdownMessage = memo(function MarkdownMessage({
  content,
}: MarkdownMessageProps) {
  return (
    <div className="min-w-0 break-words text-[0.875rem] leading-6">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          p: ({ children }) => <p className="[&:not(:first-child)]:mt-2">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          h1: ({ children }) => <h1 className="mb-2 mt-3 text-base font-semibold first:mt-0">{children}</h1>,
          h2: ({ children }) => <h2 className="mb-1.5 mt-3 text-sm font-semibold first:mt-0">{children}</h2>,
          h3: ({ children }) => <h3 className="mb-1 mt-2.5 text-sm font-semibold first:mt-0">{children}</h3>,
          ul: ({ children }) => <ul className="my-2 list-disc space-y-1 ps-5">{children}</ul>,
          ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 ps-5">{children}</ol>,
          li: ({ children }) => <li className="ps-0.5">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="my-2 border-s-2 border-gray-300 ps-3 text-gray-600">
              {children}
            </blockquote>
          ),
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-blue-700 underline decoration-blue-300 underline-offset-2 hover:text-blue-900"
            >
              {children}
            </a>
          ),
          code: ({ children, className }) => (
            <code className={`rounded bg-black/5 px-1 py-0.5 font-mono text-[0.8em] ${className || ""}`}>
              {children}
            </code>
          ),
          pre: ({ children }) => (
            <pre className="my-2 max-w-full overflow-x-auto rounded-md bg-gray-950 p-3 text-gray-100">
              {children}
            </pre>
          ),
          table: ({ children }) => (
            <div className="my-2 max-w-full overflow-x-auto rounded-md border border-gray-200">
              <table className="w-full border-collapse text-left text-xs">{children}</table>
            </div>
          ),
          th: ({ children }) => <th className="border-b bg-gray-50 px-2 py-1.5 font-semibold">{children}</th>,
          td: ({ children }) => <td className="border-b px-2 py-1.5 align-top last:border-b-0">{children}</td>,
          hr: () => <hr className="my-3 border-gray-200" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});
