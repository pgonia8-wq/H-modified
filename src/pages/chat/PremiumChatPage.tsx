import React,{useEffect,useState,useRef} from "react"
import { supabase } from "../../supabaseClient"

const PremiumChatPage = ({currentUserId}) => {

const [messages,setMessages] = useState([])
const [newMessage,setNewMessage] = useState("")

const bottomRef = useRef(null)

useEffect(()=>{

loadMessages()

const channel = supabase
.channel("global-chat")

.on(
"postgres_changes",
{
event:"INSERT",
schema:"public",
table:"global_chat_messages"
},
payload=>{
setMessages(prev=>[...prev,payload.new])
}
)

.subscribe()

return ()=>{
supabase.removeChannel(channel)
}

},[])

useEffect(()=>{
bottomRef.current?.scrollIntoView({behavior:"smooth"})
},[messages])

const loadMessages = async()=>{

const {data} = await supabase
.from("global_chat_messages")
.select("*")
.order("created_at",{ascending:false})
.limit(50)

setMessages(data.reverse())

}

const sendMessage = async()=>{

if(!newMessage.trim()) return

await supabase
.from("global_chat_messages")
.insert({
sender_id:currentUserId,
content:newMessage
})

setNewMessage("")

}

return(

<div className="flex flex-col h-screen bg-black text-white">

<div className="flex-1 overflow-y-auto p-4 space-y-2">

{messages.map(m=>(

<div
key={m.id}
className={
m.sender_id===currentUserId
? "text-right"
: "text-left"
}
>

<span className="bg-purple-600 px-3 py-1 rounded">
{m.content}
</span>

</div>

))}

<div ref={bottomRef}/>

</div>

<div className="flex gap-2 p-3 border-t border-gray-800">

<input
value={newMessage}
onChange={e=>setNewMessage(e.target.value)}
className="flex-1 bg-gray-900 px-3 py-2 rounded"
placeholder="Escribe un mensaje..."
/>

<button
onClick={sendMessage}
className="bg-purple-600 px-4 py-2 rounded"
>
Enviar
</button>

</div>

</div>

)

}

export default PremiumChatPage
