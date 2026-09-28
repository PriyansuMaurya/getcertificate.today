
import Link from 'next/link'
import Image from 'next/image'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import ResetPasswordForm from '@/components/ResetPasswordForm'
export default function ResetPassword() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-muted px-4 py-10" >
            <Card className="w-full max-w-[350px] sm:mx-auto">
                <CardHeader className="space-y-1">
                    <div className="flex justify-center py-4">
                        <Image src="/logo.png" alt="logo" width={50} height={50} />
                    </div>

                    <CardTitle className="text-2xl font-bold">Enter your new Password</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4">
                    <ResetPasswordForm />
                </CardContent>
                <CardFooter className="flex-col text-center">
                </CardFooter>
            </Card>
        </div>
    )
}