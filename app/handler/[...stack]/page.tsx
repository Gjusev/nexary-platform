import { StackHandler } from '@stackframe/stack';
import { stackServerApp } from "@/lib/stack/stack-server";

export default function Handler(props: { params: Promise<any>, searchParams: Promise<any> }) {
    return (
        <StackHandler
            app={stackServerApp}
            routeProps={props}
            fullPage={true}
        />
    );
}
