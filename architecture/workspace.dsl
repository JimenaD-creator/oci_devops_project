workspace "Project Manager" "Sprint work, KPIs, AI sprint insights, manager Q&A, and Telegram task bot." {
    !adrs doc/arch
    model {
        developer = person "Developer" "Manages tasks and views personal KPIs via Telegram or the web application." "Person"
        manager = person "Manager" "Plans team tasks and sprints, monitors KPIs and AI sprint insights, uses manager chat." "Person"
        administrator = person "Administrator" "Creates projects and teams, assigns members, maintains catalog data." "Person"

        telegram = softwareSystem "Telegram" "Messaging app for task-bot commands and replies." "External System"
        gemini = softwareSystem "Google Gemini API" "Supplies embeddings and generated text for insights and manager chat." "External System"
        github = softwareSystem "GitHub" "Source repository, pull requests, and CI workflows for the product codebase." "External System"

        taskManager = softwareSystem "Task Manager" "Plans and tracks work, KPIs, AI sprint narratives, manager chat over task data, and Telegram bot flows." {
            reactApp = container "React Frontend" "Web UI for tasks, KPIs, AI insights, manager chat, radar, and admin." "React 18" "Web Browser, Container, Single-page application"
            apiApp = container "Spring Boot Backend" "Runs business rules, exposes APIs, runs scheduled jobs, handles the Telegram bot, and coordinates AI features." "Java 17, Spring Boot" "Container, Server-side application" {
                kpiApi = component "KPI API" "Exposes productivity and delivery metrics; supports on-demand KPI refresh." "Spring REST"
                managerChatApi = component "Manager chat API" "Entry point for contextual manager chat over project and sprint data." "Spring REST"
                insightsApi = component "Sprint insights API" "Starts and reads asynchronous sprint narratives; serves developer radar views." "Spring REST"
                embeddingsApi = component "Embeddings API" "Builds and refreshes task embeddings for semantic search." "Spring REST"
                domainApi = component "Domain API" "Tasks, projects, sprints, teams, users, assignments, admin, and legacy task list." "Spring REST"

                telegramBot = component "Telegram bot" "Receives messages and runs bot command flows." "TelegramBots SDK"
                taskOps = component "Task operations" "Creates and updates tasks from the bot." "Spring Service"
                sprintContext = component "Sprint context" "Handles sprint selection in bot flows." "Spring Service"
                assignments = component "Assignments" "Reads and updates user–task and sprint-task data for the bot." "Spring Service"
                userDirectory = component "User directory" "Resolves users for bot menus." "Spring Service"
                telegramIdentity = component "Telegram identity bridge" "Links Telegram chats to application users." "Spring Service"

                kpiEngine = component "KPI engine" "Computes and stores sprint KPI fields from aggregates." "Spring Service"
                sprintAi = component "Sprint AI orchestration" "Builds insight prompts, calls the LLM, stores sprint narratives." "Spring Service"
                semanticRetrieval = component "Semantic retrieval" "Embeds text and finds similar stored tasks." "Spring Service"
                chatOrchestration = component "Chat orchestration" "Builds retrieval context and calls the LLM for manager chat." "Spring Service"

                dataRepo = component "Data Repository" "Persists domain data, such as projects, tasks, and sprint KPI snapshots." "Spring Data JPA / JDBC"
            }

            database = container "Oracle Autonomous DB" "Stores application data, KPIs, AI insights, and task search vectors." "Oracle ADB" "Database"

            apiApp -> database "Reads and writes application data through JDBC" "Oracle Net / JDBC, TCP port 1521 (TCPS/mTLS per ADB wallet if enabled)"
        }

        developer -> reactApp "Views sprint tasks, personal KPIs, and sprint insight pages"
        developer -> telegram "Lists and completes tasks, sends bot commands, and reads bot replies"
        manager -> reactApp "Manages backlog and sprints, reviews KPIs and narratives, and uses manager chat"
        manager -> telegram "Sends operator commands and reads team bot notifications"
        administrator -> reactApp "Creates projects and teams, assigns members, and edits catalog data"

        developer -> github "Commits code, opens and reviews pull requests, and follows CI results"
        manager -> github "Reviews pull requests and repository activity alongside sprint progress"

        reactApp -> kpiApi "Fetches KPI views and asks the server to recompute KPIs when needed" "JSON / HTTPS"
        reactApp -> managerChatApi "Sends manager questions with optional project and sprint scope; receives assistant answers" "JSON / HTTPS"
        reactApp -> insightsApi "Starts insight jobs, reads sprint narratives, and loads developer radar" "JSON / HTTPS"
        reactApp -> embeddingsApi "Asks the server to rebuild sprint embeddings for search" "JSON / HTTPS"
        reactApp -> domainApi "Manages tasks, projects, sprints, teams, users, assignments, profiles, and admin data" "JSON / HTTPS"

        telegram -> telegramBot "Delivers inbound messages, edits, and callback queries to the task bot" "Telegram Bot API"
        telegramBot -> taskOps "Runs the parsed task command through the task operations service using"
        telegramBot -> sprintContext "Reads and stores which sprint this Telegram conversation is working in using"
        telegramBot -> assignments "Loads and updates assigned sprint work for the signed-in bot user using"
        telegramBot -> userDirectory "Loads directory information to render bot menus and roster pickers using"
        telegramBot -> telegramIdentity "Resolves which application account is linked to this Telegram chat using"

        taskOps -> dataRepo "Reads and writes task rows affected by the bot command" "JPA / JDBC"
        sprintContext -> dataRepo "Reads and updates sprint selection state for the chat" "JPA / JDBC"
        assignments -> dataRepo "Reads and updates assignment and sprint-task rows for the acting user" "JPA / JDBC"
        userDirectory -> dataRepo "Reads user directory rows for bot menus" "JPA / JDBC"
        telegramIdentity -> dataRepo "Reads and writes links between Telegram accounts and application users" "JPA / JDBC"

        managerChatApi -> chatOrchestration "Hands manager chat requests to orchestration" "Spring"
        insightsApi -> sprintAi "Hands sprint narrative work to AI orchestration" "Spring"

        embeddingsApi -> semanticRetrieval "Asks semantic retrieval to build or refresh sprint embeddings" "Spring"

        kpiApi -> kpiEngine "Triggers KPI recomputation and aggregate reads" "Spring"
        kpiApi -> dataRepo "Runs aggregates and reads stored KPI fields for responses" "JPA / JDBC"

        chatOrchestration -> semanticRetrieval "Embeds the question and finds similar tasks" "Spring"
        semanticRetrieval -> gemini "Requests embeddings for text and receives vectors" "HTTPS"
        chatOrchestration -> dataRepo "Loads project, sprint, and top task excerpts for the prompt" "JPA / JDBC"
        chatOrchestration -> gemini "Sends the composed prompt and receives the answer text" "HTTPS"

        sprintAi -> gemini "Sends insight prompts and receives generated narrative text" "HTTPS"
        sprintAi -> kpiEngine "Refreshes sprint KPI aggregates before building the prompt" "Spring"
        sprintAi -> dataRepo "Loads sprint roster and context, then stores generated insight text" "JPA / JDBC"

        kpiEngine -> dataRepo "Updates KPI fields from aggregate queries" "JPA / JDBC"

        semanticRetrieval -> dataRepo "Reads task text and stores embedding vectors for search" "JPA / JDBC"

        domainApi -> dataRepo "Reads and writes domain entities through the repository" "JPA / JDBC"

        dataRepo -> database "Runs queries and maps rows for the application" "Oracle / JDBC"

        deploymentEnvironment "Production" {
            deploymentNode "Oracle Cloud Infrastructure" {
                containerInstance database

                ocirRegistry = deploymentNode "OCIR (container registry)" "Stores built container images for the workshop namespace; cluster nodes authenticate and pull images at deploy and rollout." "OCI Artifacts"

                okeCluster = deploymentNode "Oracle Kubernetes Engine (OKE)" {
                    deploymentNode "Namespace mtdrworkshop" "Logical boundary in the cluster for the product’s workloads." "Kubernetes" {
                        productionLb = infrastructureNode "OCI load balancer" "Public listener (port 80); forwards to in-cluster Service targets for SPA and API." "Kubernetes / OCI"

                        deploymentNode "Frontend Pod" {
                            productionWeb = containerInstance reactApp
                        }

                        deploymentNode "Backend Pod" "Runs the API workload with two replicas for availability." "Kubernetes" {
                            instances "2"
                            productionApi = containerInstance apiApp
                        }

                        productionLb -> productionWeb "Serves static SPA and assets" "HTTP / TCP, listener port 80 → pod/service target port"
                        productionLb -> productionApi "Routes REST traffic to API Service" "HTTP / TCP, listener port 80 → pod/service target port"
                    }
                }

                okeCluster -> ocirRegistry "Pulls container images when workloads are scheduled or rolled out" "HTTPS, port 443"
            }
        }
    }

    views {
        # Landscape
        systemLandscape "Landscape" "Task Manager, GitHub, Telegram, Gemini, and the people who use them." {
            include developer manager administrator taskManager github telegram gemini
            include developer->github
            include manager->github
            autoLayout lr
        }

        # System context
        systemContext taskManager "SystemContext" "Task Manager in its environment: users, Telegram, and Gemini." {
            include developer manager administrator telegram gemini
            autoLayout lr
        }

        # Containers
        container taskManager "Containers" "Splits the product into the web app, the server that runs rules and integrations, the database, and the external assistants the server calls." {
            include *
            autoLayout lr
        }

        # Components
        component apiApp "Components" "Shows REST entry points, the Telegram bot, domain and KPI services, AI orchestration, semantic retrieval, and how everything reaches stored data." {
            include *
        }

        # Deployment
        deployment taskManager "Production" "Deployment" "Task Manager runs in production on Oracle Cloud: OKE cluster, load-balanced app pods, OCIR for images, and Autonomous Database." {
            include *
        }

        # Dynamic: RAG
        dynamic apiApp "RAG_Insight_Flow" "Receives a manager question, finds relevant tasks, loads supporting context, and returns a grounded answer." {
            managerChatApi -> chatOrchestration "User query received"
            chatOrchestration -> semanticRetrieval "Embed question and rank similar tasks"
            semanticRetrieval -> gemini "Call embedding API" "HTTPS"
            chatOrchestration -> dataRepo "Load top tasks and sprint context" "JPA / JDBC"
            chatOrchestration -> gemini "Call LLM with retrieved context" "HTTPS"
            autoLayout lr
        }

        # Dynamic: Sprint insights
        dynamic apiApp "Sprint_Insights_Generation" "Refreshes sprint metrics, gathers team context, asks the external model for a narrative, and saves the result." {
            insightsApi -> sprintAi "Accepts generate narrative request"
            sprintAi -> kpiEngine "Refreshes KPI snapshot for sprint"
            sprintAi -> dataRepo "Loads sprint roster and task context" "JPA / JDBC"
            sprintAi -> gemini "Sends insight prompt and receives narrative" "HTTPS"
            sprintAi -> dataRepo "Persists insight result" "JPA / JDBC"
            autoLayout lr
        }

        # Dynamic: Embeddings
        dynamic apiApp "Embedding_Sprint_Index" "Reads every task in a sprint, obtains embeddings, and stores vectors so similarity search stays accurate." {
            embeddingsApi -> semanticRetrieval "Accepts sprint embedding job"
            semanticRetrieval -> dataRepo "Loads task text for sprint" "JPA / JDBC"
            semanticRetrieval -> gemini "Obtains embedding vectors" "HTTPS"
            semanticRetrieval -> dataRepo "Stores vectors for search" "JPA / JDBC"
            autoLayout lr
        }

        # Dynamic: Telegram
        dynamic apiApp "Telegram_Task_Command" "Turns an inbound chat message into a resolved user and updates tasks according to the command." {
            telegram -> telegramBot "Delivers inbound messages, edits, and callback queries to the task bot" "Telegram Bot API"
            telegramBot -> telegramIdentity "Resolves linked application user"
            telegramIdentity -> dataRepo "Reads or updates Telegram account link" "JPA / JDBC"
            telegramBot -> taskOps "Runs task command workflow"
            taskOps -> dataRepo "Updates task records" "JPA / JDBC"
            autoLayout lr
        }

        # Dynamic: KPI
        dynamic apiApp "KPI_Calculation_Flow" "Recomputes sprint KPI aggregates from stored work and writes the updated values back." {
            kpiApi -> kpiEngine "Request KPI calculation for sprint" "Spring"
            kpiEngine -> dataRepo "Aggregate metrics and update stored KPI values" "JPA / JDBC"
            autoLayout lr
        }

        styles {
            relationship "Relationship" {
                width 520
            }

            element "External System" {
                shape RoundedBox
                background #999999
                color #ffffff
                height 220
            }

            element "Software System" {
                shape RoundedBox
                height 320
            }

            element "Container" {
                shape RoundedBox
            }

            element "Component" {
                shape Component
            }

            element "Database" {
                shape Cylinder
            }

            element "Web Browser" {
                shape WebBrowser
            }

            element "Person" {
                shape Person
                background #08427b
                color #ffffff
                height 260
            }
        }
    }
}

