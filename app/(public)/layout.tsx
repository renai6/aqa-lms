import Navbar from '@/components/homepage/Navbar'
import Footer from '@/components/homepage/Footer'

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <main>{children}</main>
      <Footer />
    </>
  )
}
