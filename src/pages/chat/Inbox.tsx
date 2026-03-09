import React,{useEffect,useState} from "react"
import { supabase } from "../../supabaseClient"

const Inbox = ({currentUserId,openChat}) => {

const [conversations,setConversations] = useState([])

useEffect(()=>{

load()

},[])

const load = async()=>{

const {data} = await supabase
.from("conversations_with_last_message")
.select("*")
.or(`user1_id.eq.${currentUserId},user2_id.eq.${currentUserId}`)
.order("last_message_time",{ascending:false})

setConversations(data || [])

}

return(

<div className="p-4 space-y-2">

{conversations.map(c=>{

const otherId =
c.user1_id === currentUserId
? c.user2_id
: c.user1_id

return(

<div
key={c.id}
onClick={()=>openChat(c.id,otherId)}
className="flex items-center justify-between p-3 bg-gray-900 rounded cursor-pointer hover:bg-gray-800"
>

<div>

<div className="font-bold">
{otherId.slice(0,10)}
</div>

<div className="text-sm text-gray-400">
{c.last_message}
</div>

</div>

</div>

)

})}

</div>

)

}

export default Inbox
