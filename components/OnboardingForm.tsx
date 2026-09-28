"use client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useActionState } from 'react'
import { completeOnboarding } from '@/app/auth/actions'

export default function OnboardingForm({
    defaultUsername,
    defaultFirstName,
    defaultLastName,
    defaultDob,
}: {
    defaultUsername?: string
    defaultFirstName?: string
    defaultLastName?: string
    defaultDob?: string
}) {
    const initialState = {
        message: ''
    }

    const [formState, formAction] = useActionState(completeOnboarding, initialState)

    return (
        <form action={formAction}>
            <div className="grid gap-2">
                <Label htmlFor="username">Username</Label>
                <Input
                    id="username"
                    type="text"
                    placeholder="johndoe"
                    name="username"
                    minLength={3}
                    maxLength={20}
                    pattern="[a-z0-9_]+"
                    defaultValue={defaultUsername}
                    required
                />
                <p className="text-xs text-muted-foreground">
                    3-20 characters, lowercase letters, numbers and underscores. This is how others find you.
                </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                <div className="grid gap-2">
                    <Label htmlFor="firstName">First name</Label>
                    <Input
                        id="firstName"
                        type="text"
                        placeholder="John"
                        name="firstName"
                        defaultValue={defaultFirstName}
                        required
                    />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="lastName">Surname</Label>
                    <Input
                        id="lastName"
                        type="text"
                        placeholder="Doe"
                        name="lastName"
                        defaultValue={defaultLastName}
                        required
                    />
                </div>
            </div>
            <div className="grid gap-2 mt-2">
                <Label htmlFor="dob">Date of birth</Label>
                <Input
                    id="dob"
                    type="date"
                    name="dob"
                    defaultValue={defaultDob}
                    max={new Date().toISOString().split('T')[0]}
                    required
                />
            </div>
            <Button className="w-full mt-4" type="submit">Continue to dashboard</Button>
            {formState?.message && (
                <p className="text-sm text-red-500 text-center py-2">{formState.message}</p>
            )}
        </form>
    )
}
