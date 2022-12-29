import { flow, Instance, SnapshotIn, SnapshotOut, types } from "mobx-state-tree"
import { ChatModel, Chat } from "./Chat"
import { api } from "../services/core"
import { Message, MessageModel } from "./Message"
import { ContactModel } from "./Contact"
import { NewContactModel } from "./NewContact"

/**
 * Model description here for TypeScript hints.
 */
export const ChatStoreModel = types
  .model("ChatStore")
  .props({
    chats: types.array(ChatModel),
    selected: types.maybeNull(types.reference(ChatModel)),
    messages: types.map(MessageModel),
    contacts: types.array(ContactModel),
    newContact: NewContactModel
  })
  .views((self) => ({
    get sortedMessages() {
      return [...self.messages.values()].sort((a, b) => b.createdAt - a.createdAt)
    }
  })) // eslint-disable-line @typescript-eslint/no-unused-vars
  .actions((self) => {
    const loadContact = flow(function* loadContact() {
      const list = yield api.beeCore.contact.list(0, 50)
      self.contacts.replace(list)
    })
    const addContactAndCreateChat = flow(function* loadContact() {
      yield addContacts()
      yield createPMChat(self.newContact._id)
    })
    const addContacts = flow(function* addContacts() {
      const newContact = { ...self.newContact }
      try {
        yield api.beeCore.contact.add(newContact)
        self.contacts.push(newContact)
      } catch (error) {
        console.log("failed to create new contract", error)
      }
    })
    const openPMChat = flow(function* openChat(contactId: string) {
      let done = false;
      const contact = self.contacts.find(item => item._id === contactId)
      try {
        const chat: Chat = yield api.beeCore.pchat.get(contact)
        let exist = self.chats.find(item => item._id === chat._id)
        if (!exist) {
          self.chats.push(chat)
        }
        selectChat(chat._id)
        done = true;
      } catch (error) {
        console.log("can not open chat", error)
      }

      if (!done) {
        try {
          const chat: Chat = yield api.beeCore.pchat.add(contact)
          self.chats.push(chat)
          selectChat(chat._id)
          done = true;
        } catch (error) {
          console.log("can not create chat", error)
        }
      }
      if (!done) {
        throw "can not open chat"
      }
    })
    const createPMChat = flow(function* createChat(contactId: string) {
      const contact = self.contacts.find(item => item._id === contactId)
      const newChat: Chat = yield api.beeCore.pchat.add(contact)
      self.chats.push(newChat)
      selectChat(newChat._id)
    })
    const loadChatList = flow(function* loadChatList() {
      const list = yield api.beeCore.chat.list(0, 50)
      self.chats.replace(list)
    })
    const selectChat = flow(function* selectChat(chatId: string) {
      const chat = self.chats.find((item) => item._id === chatId)
      self.selected = chat
      const messages: Message[] = yield api.beeCore.messages.list(chatId, 0, 20)
      // console.log(messages)
      messages.forEach(msg => {
        self.messages.put(msg)
      });

    })
    const send = flow(function* send(msg: Message) {
      let rmsg: Message = yield api.beeCore.chat.send(self.selected._id, {
        _id: msg._id,
        chatId: "",
        createdAt: msg.createdAt,
        user: msg.user._id,
        text: msg.text
      })
      // setMsgs([rmsg, ...self.messages])
      self.messages.put(rmsg)
    })
    const clear = () => {
      self.selected = null
      self.messages.clear()
    }
    const onMessageChange = flow(function* onMessageChange(id: string, action: string) {
      //Todo: to much if and else need to clean it up 
      console.log("update message called with ", id, action)
      if (self.selected !== null && self.messages.size > 0) {
        console.log("pass data check")
        try {
          let rmsg: Message = yield api.beeCore.messages.get(id)
          console.log(rmsg._id, rmsg.chatId)
          if (action === "received") {
            //TODO: Fix It
            if (self.selected._id === rmsg.chatId) {
              self.messages.set(rmsg._id, rmsg)
            }else {
              if (!self.chats.map(i=>i._id).includes(rmsg.chatId)){
                let newCH: Chat = yield api.beeCore.chat.get(rmsg.chatId)
                self.chats.push(newCH);
              }
            }
           
          }
          if (self.selected._id === rmsg.chatId && self.selected._id === rmsg.chatId && (action === "sent" || action === "failed")) {
            const msg = self.messages.get(rmsg._id)
            if (msg !== undefined) {
              switch (action) {
                case "sent":
                  msg.onSent()
                  break
                case "failed":
                  msg.onFailed()
              }

              console.log("update message status :")
            }

          }

        } catch (error) {
          console.log(error)
        }

      }
    })
    const afterCreate = flow(function* afterCreate() {
      yield loadChatList()
      yield loadContact()
    })
    return {
      openPMChat,
      selectChat,
      loadChatList,
      createPMChat,
      send,
      clear,
      addContacts,
      loadContact,
      afterCreate,
      addContactAndCreateChat,
      onMessageChange
    }
  }) // eslint-disable-line @typescript-eslint/no-unused-vars

export interface ChatList extends Instance<typeof ChatStoreModel> { }
export interface ChatListSnapshotOut extends SnapshotOut<typeof ChatStoreModel> { }
export interface ChatListSnapshotIn extends SnapshotIn<typeof ChatStoreModel> { }
export const createChatListDefaultModel = () => types.optional(ChatStoreModel, {})
