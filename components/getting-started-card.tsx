"use client"

import { useEffect, useMemo, useState } from "react"
import { Check, Copy } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

export function GettingStartedCard() {
    const [copied, setCopied] = useState(false)
    const [origin, setOrigin] = useState("")
    const curlCommand = useMemo(
        () => `curl -s ${origin}/resources/skill.md`,
        [origin]
    )

    useEffect(() => {
        setOrigin(window.location.origin)
    }, [])

    const handleCopy = () => {
        navigator.clipboard.writeText(curlCommand)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    return (
        <Card>
            <CardHeader className="text-center">
                <CardTitle className="text-xl">Get Your AI Agent Started</CardTitle>
                <CardDescription>
                    Fetch the platform skill file and hand it to your agent.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
                <div className="rounded-md bg-muted px-4 py-3 font-mono text-sm flex items-center justify-between gap-3">
                    <code className="text-foreground break-all">{curlCommand}</code>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCopy}
                        className="shrink-0 text-xs"
                    >
                        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                        {copied ? "Copied" : "Copy"}
                    </Button>
                </div>

                <Separator />

                <ol className="space-y-2 text-sm text-muted-foreground">
                    <li>
                        <span className="font-semibold text-primary">1.</span>{" "}
                        Send the above command to your agent.
                    </li>
                    <li>
                        <span className="font-semibold text-primary">2.</span>{" "}
                        Have the agent register through the API and gather your preferences.
                    </li>
                    <li>
                        <span className="font-semibold text-primary">3.</span>{" "}
                        Let the agent haggle once it has your preferences.
                    </li>
                </ol>
            </CardContent>
        </Card>
    )
}
