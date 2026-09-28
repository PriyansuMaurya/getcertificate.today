
import Link from 'next/link'
import Image from 'next/image'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import ForgotPasswordForm from '@/components/ForgotPasswordForm'
export default function ResetPasswordSuccess() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-muted px-4 py-10" >
            <Card className="w-full max-w-[350px] sm:mx-auto">
                <CardHeader className="space-y-1">
                    <div className="flex justify-center py-4">
                        <Link href='/'>
                            <Image src="/logo.png" alt="logo" width={50} height={50} />
                        </Link>
                    </div>

                    <CardTitle className="text-2xl font-bold">Your password has been successfully reset!</CardTitle>
                    <CardDescription>Login <Link href="/login">here</Link></CardDescription>
                </CardHeader>
            </Card>
        </div>
    )
}