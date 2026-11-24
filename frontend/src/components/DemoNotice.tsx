import { Link } from 'react-router-dom';

interface DemoNoticeProps {
  title?: string;
  description: string;
  linkTo?: string;
  linkLabel?: string;
  /** Compact panel for use inside a page that already has a heading. */
  inline?: boolean;
}

/**
 * A demo screen that would otherwise dead-end. It says what the real screen
 * needs and why nothing is shown, so an empty page never reads as a broken one.
 */
export default function DemoNotice({ title, description, linkTo, linkLabel, inline }: DemoNoticeProps) {
  if (inline) {
    return (
      <section className="rounded-[10px] border border-[#E2E1DB] bg-[#FAFAF7] px-4 py-3">
        <h3 className="text-[13px] font-medium text-[#1A1C1F]">{title}</h3>
        <p className="mt-1 text-[13px] leading-relaxed text-[#43474C]">{description}</p>
        {linkTo && linkLabel && (
          <Link to={linkTo} className="mt-1.5 inline-block text-[13px] font-medium text-[#17406F] hover:text-[#12355B]">
            {linkLabel}
          </Link>
        )}
      </section>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h2 className="text-xl font-semibold text-[#1A1C1F]">{title}</h2>
      <section className="card p-6">
        <p className="text-sm leading-relaxed text-[#43474C]">{description}</p>
        {linkTo && linkLabel && (
          <Link to={linkTo} className="mt-4 inline-block text-sm font-medium text-[#17406F] hover:text-[#12355B]">
            {linkLabel}
          </Link>
        )}
      </section>
    </div>
  );
}
