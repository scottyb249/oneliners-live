import JoinForm from '@/app/components/JoinForm'

export default function Home() {
  return (
    <main className="flex min-h-full flex-col items-center justify-center bg-zinc-950 px-4 py-16">
      {/* Logo */}
      <div className="mb-8 flex flex-col items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.png"
          alt="O.N.E. Liners Live"
          className="w-56 h-auto"
        />
        <p className="mt-3 text-base text-white/40">
          One prompt. One line. One winner.
        </p>
      </div>

      <JoinForm />
    </main>
  )
}
